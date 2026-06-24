import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Forward, Loader2, Lock, Paperclip, Reply, Save, X } from "lucide-react";
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
import type { ClientInvoice, Ticket, TicketInbox, TicketMessage } from "@/modules/types";
import { getTicketReplyStatusActions } from "@/modules/tickets/ticketReplyStatusActions";
import { TicketReplyComposerActions } from "@/modules/tickets/TicketReplyComposerActions";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TicketRecipientInput } from "@/modules/tickets/TicketRecipientInput";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import { isValidRecordId } from "@/lib/isValidRecordId";
import { cn } from "@/lib/utils";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

type ComposeMode = "reply" | "forward" | "internal";

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
  const [isMinimized, setIsMinimized] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("reply");
  const [forwardContext, setForwardContext] = useState<ForwardContext | null>(
    null,
  );
  const [bodyHtml, setBodyHtml] = useState(() => createDefaultReplyHtml());
  const [internalNoteText, setInternalNoteText] = useState("");
  const [toRecipients, setToRecipients] = useState("");
  const [ccRecipients, setCcRecipients] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [submittingAs, setSubmittingAs] = useState<
    "internal" | "forward" | TicketWorkflowStatus | null
  >(null);
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

  const replyStatusActions = useMemo(
    () => getTicketReplyStatusActions(ticket.status),
    [ticket.status],
  );

  const activeInbox = useMemo(() => {
    const targetEmail = (
      ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL
    ).toLowerCase();
    return (
      ticketInboxes.find(
        (entry) => entry.email?.trim().toLowerCase() === targetEmail,
      ) ?? ticketInboxes[0] ??
      null
    );
  }, [ticket.inbox_address, ticketInboxes]);

  const inboxSignature = useMemo(() => {
    return (
      activeInbox?.reply_signature_html?.trim() ||
      activeInbox?.reply_signature_text?.trim() ||
      null
    );
  }, [activeInbox]);

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
    composeMode === "internal"
      ? Boolean(internalNoteText.trim()) || pendingFiles.length > 0
      : (composeMode === "forward" && forwardContext != null) ||
        hasReplyContentHtml(bodyHtml) ||
        pendingFiles.length > 0;

  const composerTabSummary = useMemo(() => {
    const truncate = (value: string, max = 72) => {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (!normalized) return "";
      return normalized.length > max
        ? `${normalized.slice(0, max)}…`
        : normalized;
    };

    const attachmentHint =
      pendingFiles.length > 0
        ? `${pendingFiles.length} attachment${pendingFiles.length === 1 ? "" : "s"}`
        : "";

    if (composeMode === "internal") {
      const preview = truncate(internalNoteText, 80);
      return {
        title: "Internal note",
        context: "Team only",
        preview: preview || attachmentHint || "Empty draft",
      };
    }

    if (composeMode === "forward") {
      const recipient = toRecipients.trim().split(",")[0]?.trim();
      const preview = truncate(
        htmlToPlainText(stripReplySignatureHtml(bodyHtml)),
        80,
      );
      return {
        title: "Forward",
        context: recipient ? `To ${recipient}` : "Add recipients",
        preview: preview || attachmentHint || "No message yet",
      };
    }

    const recipient =
      toRecipients.trim().split(",")[0]?.trim() ||
      defaultRecipientEmail ||
      "Add recipient";
    const preview = truncate(
      htmlToPlainText(stripReplySignatureHtml(bodyHtml)),
      80,
    );

    return {
      title: "Reply",
      context: recipient.includes("@") ? `To ${recipient}` : recipient,
      preview: preview || attachmentHint || "Empty draft",
    };
  }, [
    bodyHtml,
    composeMode,
    defaultRecipientEmail,
    internalNoteText,
    pendingFiles.length,
    toRecipients,
  ]);

  const resetDraft = () => {
    setBodyHtml(defaultReplyHtml);
    setInternalNoteText("");
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
    setIsMinimized(false);
    resetDraft();
  };

  const minimizeComposer = () => {
    setIsMinimized(true);
  };

  const expandComposer = () => {
    setIsMinimized(false);
    requestAnimationFrame(() => {
      if (composeMode === "internal") return;
      editorRef.current?.focus();
    });
  };

  const openComposer = (mode: ComposeMode) => {
    setComposeMode(mode);
    setIsExpanded(true);
    setIsMinimized(false);
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
    } else if (mode === "internal") {
      setForwardContext(null);
      setInternalNoteText("");
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
    setIsMinimized(false);
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
    setIsMinimized(false);
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
      nextStatus,
    }: {
      isInternalNote: boolean;
      messageBody: string;
      htmlBody?: string;
      toEmails?: string[];
      ccEmails?: string[];
      nextStatus?: TicketWorkflowStatus;
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
        nextStatus,
      });
    },
    onSuccess: (result) => {
      setIsExpanded(false);
      setIsMinimized(false);
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

  const handleSend = ({
    isInternalNote,
    nextStatus,
  }: {
    isInternalNote: boolean;
    nextStatus?: TicketWorkflowStatus;
  }) => {
    if (!hasContent) {
      notify("Add a message or attach a file", { type: "warning" });
      return;
    }

    if (isInternalNote) {
      const noteBody = internalNoteText.trim();
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
      setSubmittingAs("forward");
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
    setSubmittingAs(nextStatus ?? "open");
    submitMutation.mutate({
      isInternalNote: false,
      messageBody: textBody,
      htmlBody,
      toEmails,
      ccEmails: ccEmails.length ? ccEmails : undefined,
      nextStatus,
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

  const minimizeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-muted-foreground"
      disabled={isPending}
      aria-label="Minimize"
      onClick={minimizeComposer}
    >
      <ChevronDown className="size-4" />
    </Button>
  );

  if (!isExpanded) {
    return (
      <div
        className={cn(
          "flex items-center justify-end gap-2 bg-background px-5 py-2.5",
          edgeBorderClass,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Internal note"
              onClick={() => openComposer("internal")}
            >
              <Lock className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Internal note</TooltipContent>
        </Tooltip>
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

  if (isMinimized) {
    return (
      <div
        className={cn(
          "flex justify-end border-t bg-background px-4 py-2.5 md:px-5",
          edgeBorderClass,
        )}
      >
        <div className="flex w-full max-w-sm items-stretch overflow-hidden rounded-lg border border-border/80 bg-muted/35 shadow-sm sm:w-auto sm:min-w-[17rem]">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/55"
            onClick={expandComposer}
          >
            <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-snug text-foreground">
                {composerTabSummary.title}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {composerTabSummary.context}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {composerTabSummary.preview}
              </p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-auto w-9 shrink-0 rounded-none border-l border-border/60 hover:bg-muted/70"
            aria-label="Close draft"
            onClick={(event) => {
              event.stopPropagation();
              collapseComposer();
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (composeMode === "internal") {
    return (
      <div className={cn("shrink-0 bg-background", edgeBorderClass)}>
        <div className={cn("overflow-hidden bg-background", slideAnimationClass)}>
          <div className="flex items-center justify-between border-b bg-muted/10 px-4 py-2 md:px-5">
            <span className="text-xs text-muted-foreground">Internal note</span>
            {minimizeButton}
          </div>
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
                  <span className="max-w-[160px] truncate">
                    {pending.file.name}
                  </span>
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

          <Textarea
            value={internalNoteText}
            onChange={(event) => setInternalNoteText(event.target.value)}
            placeholder="Add an internal note for the team…"
            rows={5}
            disabled={isPending}
            className="min-h-32 resize-y rounded-none border-0 px-4 py-3 text-sm shadow-none focus-visible:ring-0 md:px-5"
            autoFocus
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/15 px-4 py-2.5 md:px-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              disabled={isPending}
              aria-label="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-9 gap-2"
                disabled={isPending || !hasContent}
                onClick={() => handleSend({ isInternalNote: true })}
              >
                {submittingAs === "internal" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save note
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={isPending}
                onClick={collapseComposer}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 bg-background", edgeBorderClass)}>
      <div
        className={cn(
          "overflow-hidden bg-background",
          slideAnimationClass,
        )}
      >
        <div className="border-b bg-muted/10 px-4 py-2.5 md:px-5">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm">
              <span className="text-xs text-muted-foreground">From</span>
              <span className="min-w-0 truncate font-medium text-foreground">
                {fromAddress}
              </span>

              <label
                htmlFor={`ticket-reply-to-${ticket.id}`}
                className="self-center text-xs text-muted-foreground"
              >
                To
              </label>
              <TicketRecipientInput
                id={`ticket-reply-to-${ticket.id}`}
                value={toRecipients}
                onChange={setToRecipients}
                placeholder="Search contact or type email…"
                disabled={isPending}
                className="h-8 min-w-0 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-none focus-visible:ring-1"
              />

              <label
                htmlFor={`ticket-reply-cc-${ticket.id}`}
                className="self-center text-xs text-muted-foreground"
              >
                Cc
              </label>
              <TicketRecipientInput
                id={`ticket-reply-cc-${ticket.id}`}
                value={ccRecipients}
                onChange={setCcRecipients}
                placeholder="Optional"
                disabled={isPending}
                className="h-8 min-w-0 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-none focus-visible:ring-1"
              />
            </div>
            {minimizeButton}
          </div>
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
          inbox={activeInbox}
          contact={contact}
          company={company}
          onInsertTemplate={handleInsertTemplate}
          onAttachClick={() => fileInputRef.current?.click()}
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
          <div className="border-t bg-muted/10 px-4 py-3 md:px-5">
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

        <TicketReplyComposerActions
          composeMode={composeMode}
          actions={replyStatusActions}
          disabled={isPending}
          hasContent={hasContent}
          submittingAs={submittingAs}
          onCancel={collapseComposer}
          onSendReply={(nextStatus) =>
            handleSend({ isInternalNote: false, nextStatus })
          }
          onSendForward={() => handleSend({ isInternalNote: false })}
        />
      </div>
    </div>
  );
};
