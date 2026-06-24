import { useMutation } from "@tanstack/react-query";
import { ChevronUp, Forward, Paperclip, Reply, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import type { ClientInvoice, Ticket, TicketInbox, TicketMessage } from "@/modules/types";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
import {
  canSendTicketOutboundAttachments,
  isTicketAwaitingPaidDelivery,
  TICKET_AWAITING_PAYMENT_ATTACHMENT_HINT,
  TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE,
} from "@/modules/tickets/ticketOutboundAttachments";
import { TicketComposerToolbar } from "@/modules/tickets/TicketComposerToolbar";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { TicketReplyRichComposer } from "@/modules/tickets/TicketReplyRichComposer";
import { expandTicketReplyTemplate } from "@/modules/tickets/ticketReplyTemplates";
import {
  createDefaultReplyHtml,
  hasReplyContentHtml,
  htmlToPlainText,
  insertAboveSignatureHtml,
  stripReplySignatureHtml,
} from "@/modules/tickets/ticketReplyRichText";
import {
  buildForwardOutboundBodies,
  buildReplyOutboundBodiesFromHtml,
  isValidEmailList,
  parseEmailList,
  type ForwardMessage,
} from "@/modules/tickets/ticketReplySignature";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENT_BYTES,
  uploadTicketAttachment,
  type TicketReplyAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import { Button } from "@/components/ui/button";
import { TicketRecipientInput } from "@/modules/tickets/TicketRecipientInput";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import { isValidRecordId } from "@/lib/isValidRecordId";
import { cn } from "@/lib/utils";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

type ComposeMode = "reply" | "forward";

type ForwardContext = {
  message: ForwardMessage;
};

export const TicketReplyForm = ({
  ticket,
  placement = "bottom",
  quoteText,
  onQuoteApplied,
  onSent,
}: {
  ticket: Ticket;
  placement?: "top" | "bottom";
  quoteText?: string | null;
  onQuoteApplied?: () => void;
  onSent?: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("reply");
  const [forwardContext, setForwardContext] = useState<ForwardContext | null>(
    null,
  );
  const [bodyHtml, setBodyHtml] = useState(() => createDefaultReplyHtml());
  const [toRecipients, setToRecipients] = useState("");
  const [ccRecipients, setCcRecipients] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [submittingAs, setSubmittingAs] = useState<"reply" | "internal" | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: ticket.contact_id ?? "" },
    { enabled: Boolean(ticket.contact_id) },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: ticket.company_id ?? "" },
    { enabled: Boolean(ticket.company_id) },
  );

  const { data: invoiceRows = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "id@eq": ticket.invoice_id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: isValidRecordId(ticket.invoice_id) },
  );
  const invoice = invoiceRows[0] ?? null;

  const awaitingPaidDelivery = isTicketAwaitingPaidDelivery(ticket, invoice);
  const outboundAttachmentsAllowed = canSendTicketOutboundAttachments(
    ticket,
    invoice,
  );

  const defaultRecipientEmail = useMemo(
    () => resolveTicketRequesterEmail(ticket, company, contact) ?? "",
    [ticket, company, contact],
  );

  const { data: recentMessages = [] } = useGetList<TicketMessage>(
    "ticket_messages",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "created_at", order: "DESC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: Boolean(ticket.id) },
  );

  const { data: ticketInboxes = [] } = useGetList<TicketInbox>(
    "ticket_inboxes",
    {
      filter: { "is_active@eq": true },
      sort: { field: "id", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
  );

  const inboxSignature = useMemo(() => {
    const targetEmail = (
      ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL
    ).toLowerCase();
    const inbox =
      ticketInboxes.find(
        (entry) => entry.email?.trim().toLowerCase() === targetEmail,
      ) ?? ticketInboxes[0];
    return (
      inbox?.reply_signature_html?.trim() ||
      inbox?.reply_signature_text?.trim() ||
      null
    );
  }, [ticket.inbox_address, ticketInboxes]);

  const defaultReplyHtml = useMemo(
    () => createDefaultReplyHtml(inboxSignature),
    [inboxSignature],
  );

  const forwardSourceMessage =
    recentMessages.find((message) => message.direction === "inbound") ??
    recentMessages[0];

  const replyMinHeight = composeMode === "forward" ? 96 : 200;
  const replyMaxHeight = composeMode === "forward" ? 280 : 720;

  const fromAddress = ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const hasContent =
    (composeMode === "forward" && forwardContext != null) ||
    hasReplyContentHtml(bodyHtml) ||
    pendingFiles.length > 0;

  const resetDraft = () => {
    setBodyHtml(defaultReplyHtml);
    setForwardContext(null);
    setToRecipients(defaultRecipientEmail);
    setCcRecipients("");
    setPendingFiles((current) => {
      current.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      return [];
    });
  };

  const collapseComposer = () => {
    setIsExpanded(false);
    resetDraft();
  };

  const openComposer = (mode: ComposeMode) => {
    setComposeMode(mode);
    setIsExpanded(true);
    setCcRecipients("");
    setPendingFiles((current) => {
      current.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      return [];
    });

    if (mode === "reply") {
      setForwardContext(null);
      setToRecipients(defaultRecipientEmail);
      setBodyHtml(defaultReplyHtml);
    } else {
      setForwardContext(
        forwardSourceMessage
          ? { message: forwardSourceMessage }
          : null,
      );
      setToRecipients("");
      setBodyHtml(defaultReplyHtml);
    }

    requestAnimationFrame(() => editorRef.current?.focus());
  };

  useEffect(() => {
    if (!defaultRecipientEmail) return;
    setToRecipients((current) => current.trim() || defaultRecipientEmail);
  }, [defaultRecipientEmail]);

  useEffect(() => {
    setIsExpanded(false);
    setComposeMode("reply");
    resetDraft();
  }, [ticket.id, defaultRecipientEmail, defaultReplyHtml]);

  useEffect(() => {
    if (!quoteText?.trim()) return;
    const quotedLines = quoteText
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    setComposeMode("reply");
    setIsExpanded(true);
    setBodyHtml((current) =>
      insertAboveSignatureHtml(current, quotedLines.replace(/\n/g, "<br/>")),
    );
    onQuoteApplied?.();
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [quoteText, onQuoteApplied]);

  const addPendingFile = (file: File) => {
    if (pendingFiles.length >= MAX_TICKET_ATTACHMENTS) {
      notify(`You can attach up to ${MAX_TICKET_ATTACHMENTS} files`, {
        type: "warning",
      });
      return;
    }
    if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
      notify(`"${file.name}" exceeds the 10 MB limit`, { type: "warning" });
      return;
    }

    const id = crypto.randomUUID();
    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
    setPendingFiles((current) => [...current, { id, file, previewUrl }]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const clearPendingFiles = () => {
    setPendingFiles((current) => {
      current.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
      return [];
    });
  };

  const submitMutation = useMutation({
    mutationFn: async ({
      isInternalNote,
      messageBody,
      htmlBody,
      toEmails,
      ccEmails,
    }: {
      isInternalNote: boolean;
      messageBody: string;
      htmlBody?: string;
      toEmails?: string[];
      ccEmails?: string[];
    }) => {
      const uploadedAttachments: TicketReplyAttachment[] = [];
      for (const pending of pendingFiles) {
        uploadedAttachments.push(await uploadTicketAttachment(pending.file));
      }

      return dataProvider.replyTicket({
        ticketId: ticket.id,
        body: messageBody,
        htmlBody,
        isInternalNote,
        attachments: uploadedAttachments,
        toEmails,
        ccEmails,
      });
    },
    onSuccess: (result) => {
      setIsExpanded(false);
      resetDraft();
      refresh();
      onSent?.();
      if (result.is_internal_note) {
        notify("Internal note added", { type: "success" });
        return;
      }
      if (result.email_sent) {
        notify(
          composeMode === "forward" ? "Message forwarded" : "Reply sent",
          { type: "success" },
        );
      } else if (result.email_skipped) {
        notify(
          "Reply saved. Email was not sent — check Communications settings.",
          { type: "warning" },
        );
      } else {
        notify(
          composeMode === "forward" ? "Message forwarded" : "Reply sent",
          { type: "success" },
        );
      }
    },
    onError: (error: Error, variables) => {
      notify(
        error.message ||
          (variables.isInternalNote
            ? "Failed to add internal note"
            : "Failed to send message"),
        { type: "error" },
      );
    },
    onSettled: () => setSubmittingAs(null),
  });

  const handleSend = (isInternalNote: boolean) => {
    if (!hasContent) {
      notify("Add a message or attach a file", { type: "warning" });
      return;
    }

    if (isInternalNote) {
      const noteBody =
        htmlToPlainText(stripReplySignatureHtml(bodyHtml)).trim() ||
        htmlToPlainText(bodyHtml).trim();
      if (!noteBody && pendingFiles.length === 0) {
        notify("Add a message or attach a file", { type: "warning" });
        return;
      }
      setSubmittingAs("internal");
      submitMutation.mutate({
        isInternalNote: true,
        messageBody: noteBody || "(Attachment)",
      });
      return;
    }

    const expandedHtml = expandTicketReplyTemplate(
      bodyHtml,
      ticket,
      contact,
      company,
    );
    const userNoteHtml = stripReplySignatureHtml(expandedHtml);

    const toEmails = parseEmailList(toRecipients);
    const ccEmails = parseEmailList(ccRecipients);

    if (!isValidEmailList(toEmails)) {
      notify("Enter at least one valid To email (comma-separated)", {
        type: "warning",
      });
      return;
    }
    if (ccRecipients.trim() && !isValidEmailList(ccEmails)) {
      notify("Cc contains an invalid email address", { type: "warning" });
      return;
    }

    if (
      pendingFiles.length > 0 &&
      !outboundAttachmentsAllowed
    ) {
      notify(TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE, { type: "warning" });
      return;
    }

    if (composeMode === "forward" && forwardContext) {
      const { textBody, htmlBody } = buildForwardOutboundBodies({
        ticket,
        message: forwardContext.message,
        userNoteHtml,
        signatureHtml: inboxSignature,
      });
      setSubmittingAs("reply");
      submitMutation.mutate({
        isInternalNote: false,
        messageBody: textBody || "(See attachments)",
        htmlBody,
        toEmails,
        ccEmails: ccEmails.length ? ccEmails : undefined,
      });
      return;
    }

    const { textBody, htmlBody } =
      buildReplyOutboundBodiesFromHtml(expandedHtml, inboxSignature);
    setSubmittingAs("reply");
    submitMutation.mutate({
      isInternalNote: false,
      messageBody: textBody,
      htmlBody,
      toEmails,
      ccEmails: ccEmails.length ? ccEmails : undefined,
    });
  };

  const handleInsertTemplate = (text: string) => {
    setBodyHtml((current) => insertAboveSignatureHtml(current, text));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach(addPendingFile);
  };

  const isPending = submitMutation.isPending;
  const edgeBorderClass = placement === "bottom" ? "border-t" : "border-b";
  const slideAnimationClass =
    placement === "bottom"
      ? "animate-in slide-in-from-bottom-2 duration-200"
      : "animate-in slide-in-from-top-2 duration-200";

  if (!isExpanded) {
    return (
      <div
        className={cn(
          "flex items-center justify-end gap-2 bg-background px-5 py-2.5",
          edgeBorderClass,
        )}
      >
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-md px-5"
          onClick={() => openComposer("reply")}
        >
          <Reply className="size-4" />
          Reply
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-md px-5"
          onClick={() => openComposer("forward")}
        >
          <Forward className="size-4" />
          Forward
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 bg-background", edgeBorderClass)}>
      <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-2">
        <p className="text-sm font-medium text-foreground">
          {composeMode === "forward" ? "Forward" : "Reply"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={isPending}
            onClick={collapseComposer}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-muted-foreground"
            disabled={isPending}
            onClick={collapseComposer}
          >
            <ChevronUp className="size-4" />
            Minimize
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden bg-background",
          slideAnimationClass,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b bg-muted/20 px-5 py-2 text-xs">
          <span className="shrink-0 text-muted-foreground">From</span>
          <span className="shrink-0 font-medium text-foreground">{fromAddress}</span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <label
            htmlFor={`ticket-reply-to-${ticket.id}`}
            className="shrink-0 text-muted-foreground"
          >
            To
          </label>
          <TicketRecipientInput
            id={`ticket-reply-to-${ticket.id}`}
            value={toRecipients}
            onChange={setToRecipients}
            placeholder={
              composeMode === "forward"
                ? "Search contact or type email…"
                : "Search contact or type email…"
            }
            disabled={isPending}
          />
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <label
            htmlFor={`ticket-reply-cc-${ticket.id}`}
            className="shrink-0 text-muted-foreground"
          >
            Cc
          </label>
          <TicketRecipientInput
            id={`ticket-reply-cc-${ticket.id}`}
            value={ccRecipients}
            onChange={setCcRecipients}
            placeholder="Optional"
            disabled={isPending}
            className="min-w-[8rem]"
          />
        </div>

        {awaitingPaidDelivery ? (
          <p className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-xs text-foreground">
            {TICKET_AWAITING_PAYMENT_ATTACHMENT_HINT}
          </p>
        ) : null}

        {pendingFiles.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b px-5 py-2">
            {pendingFiles.map((pending) => (
              <div
                key={pending.id}
                className="relative flex items-center gap-2 border bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                {pending.previewUrl ? (
                  <img
                    src={pending.previewUrl}
                    alt=""
                    className="size-8 object-cover"
                  />
                ) : (
                  <Paperclip className="size-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[160px] truncate">{pending.file.name}</span>
                <button
                  type="button"
                  className="p-0.5 hover:bg-muted"
                  onClick={() => removePendingFile(pending.id)}
                  aria-label="Remove attachment"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            const files = event.target.files;
            if (!files) return;
            Array.from(files).forEach(addPendingFile);
            event.target.value = "";
          }}
        />

        <TicketComposerToolbar
          editorRef={editorRef}
          onEditorChange={setBodyHtml}
          disabled={isPending}
          ticket={ticket}
          contact={contact}
          company={company}
          onInsertTemplate={handleInsertTemplate}
          onAttachClick={() => fileInputRef.current?.click()}
          onSendInternal={() => handleSend(true)}
          onSendReply={() => handleSend(false)}
          canSend={hasContent}
          submittingAs={submittingAs}
        />

        <TicketReplyRichComposer
          editorRef={editorRef}
          value={bodyHtml}
          onChange={setBodyHtml}
          onPaste={handlePaste}
          placeholder={
            composeMode === "forward"
              ? "Add a note above the forwarded message..."
              : "Write your reply..."
          }
          disabled={isPending}
          minHeight={replyMinHeight}
          maxHeight={replyMaxHeight}
          resizeTrigger={isExpanded}
          className={composeMode === "forward" ? "min-h-24" : "min-h-[12.5rem]"}
        />

        {composeMode === "forward" && forwardContext ? (
          <div className="border-t bg-muted/10 px-5 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Forwarded message
            </p>
            <div className="max-h-[min(40vh,320px)] overflow-y-auto rounded-md border bg-background p-4 text-sm">
              <TicketMessageBody
                body={forwardContext.message.body}
                htmlBody={forwardContext.message.html_body}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
