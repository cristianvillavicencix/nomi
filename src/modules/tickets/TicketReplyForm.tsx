import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Paperclip,
  Reply,
  Save,
  X,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  ClientInvoice,
  Ticket,
  TicketDeliverable,
  TicketInbox,
  TicketMessage,
} from "@/modules/types";
import {
  getTicketReplyStatusTransitions,
  normalizeTicketWorkflowStatus,
} from "@/modules/tickets/ticketReplyStatusActions";
import {
  TicketReplyComposerActions,
  type TicketReplySubmittingAs,
} from "@/modules/tickets/TicketReplyComposerActions";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
import {
  canSendTicketOutboundAttachments,
  isTicketAwaitingPaidDelivery,
  TICKET_AWAITING_PAYMENT_ATTACHMENT_HINT,
  TICKET_AWAITING_PAYMENT_ATTACHMENT_MESSAGE,
} from "@/modules/tickets/ticketOutboundAttachments";
import {
  paintSendProgress,
  useSendProgressDock,
} from "@/modules/tickets/SendProgressDock";
import { TicketComposerToolbar } from "@/modules/tickets/TicketComposerToolbar";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { TicketReplyRichComposer } from "@/modules/tickets/TicketReplyRichComposer";
import { expandTicketReplyTemplate } from "@/modules/tickets/ticketReplyTemplates";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  assembleReplyComposerHtml,
  createDefaultReplyHtml,
  extractReplyComposerParts,
  hasReplyContentHtml,
  htmlToPlainText,
  insertAboveSignatureHtml,
  stripReplyComposerMetaHtml,
} from "@/modules/tickets/ticketReplyRichText";
import { buildQuotedReplyEditorHtml } from "@/modules/tickets/ticketReplyQuotedThread";
import {
  buildForwardOutboundBodies,
  buildReplyOutboundBodiesFromHtml,
  isValidEmailList,
  parseEmailList,
  type ForwardMessage,
} from "@/modules/tickets/ticketReplySignature";
import {
  MAX_TICKET_ATTACHMENT_BYTES,
  MAX_TICKET_ATTACHMENTS,
  uploadTicketAttachmentWithProgress,
  uploadTicketReplyAttachmentWithProgress,
  type PendingTicketAttachment,
  type TicketReplyAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import {
  shouldSendTicketReplyAttachmentAsLink,
  ticketAttachmentLimitLabel,
  useTicketAttachmentLimitBytes,
} from "@/modules/tickets/ticketReplyAttachmentLimits";
import { TicketPendingAttachmentItem } from "@/modules/tickets/TicketPendingAttachmentItem";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { TicketRecipientInput } from "@/modules/tickets/TicketRecipientInput";
import {
  isTicketInboxRecipient,
  resolveTicketReplyRecipientEmail,
} from "@/modules/tickets/ticketRequester";
import { allDeliverablesHaveBilling } from "@/modules/tickets/supplementPricing";
import { isValidRecordId } from "@/lib/isValidRecordId";
import {
  TicketReplyInvoiceSection,
  type TicketReplyInvoiceSectionHandle,
} from "@/modules/tickets/TicketReplyInvoiceSection";
import { cn } from "@/lib/utils";

type ComposeMode = "reply" | "forward" | "internal";
type ReplySendIntent = "reply" | "reply_and_invoice";

type ForwardContext = {
  message: ForwardMessage;
};

export type TicketReplyFormHandle = {
  openComposer: (
    mode: ComposeMode,
    options?: { replyIntent?: ReplySendIntent },
  ) => void;
};

type ComposerVisibilityMode = "public" | "private";

const TicketComposerModeTabs = ({
  mode,
  onChange,
}: {
  mode: ComposerVisibilityMode;
  onChange: (mode: ComposerVisibilityMode) => void;
}) => (
  <div className="flex items-center border-b px-3 md:px-4">
    <button
      type="button"
      onClick={() => onChange("public")}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
        mode === "public"
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Reply className="size-3.5" />
      Public Reply
      {mode === "public" ? (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      ) : null}
    </button>
    <button
      type="button"
      onClick={() => onChange("private")}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
        mode === "private"
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Lock className="size-3.5" />
      Private Comment
      {mode === "private" ? (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      ) : null}
    </button>
  </div>
);

export const TicketReplyForm = forwardRef<
  TicketReplyFormHandle,
  {
    ticket: Ticket;
    placement?: "top" | "bottom" | "dock";
    quoteMessage?: TicketMessage | null;
    onQuoteApplied?: () => void;
    onSent?: () => void;
  }
>(function TicketReplyForm(
  { ticket, placement = "bottom", quoteMessage, onQuoteApplied, onSent },
  ref,
) {
  const isDock = placement === "dock";
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("reply");
  const [replySendIntent, setReplySendIntent] =
    useState<ReplySendIntent>("reply");
  const [forwardContext, setForwardContext] = useState<ForwardContext | null>(
    null,
  );
  const [bodyHtml, setBodyHtml] = useState(() => createDefaultReplyHtml());
  const [internalNoteText, setInternalNoteText] = useState("");
  const [toRecipients, setToRecipients] = useState("");
  const [ccRecipients, setCcRecipients] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showInvoiceNote, setShowInvoiceNote] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingTicketAttachment[]>(
    [],
  );
  const replyAttachmentLimitBytes = useTicketAttachmentLimitBytes();
  const [submittingAs, setSubmittingAs] =
    useState<TicketReplySubmittingAs>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const invoiceSectionRef = useRef<TicketReplyInvoiceSectionHandle>(null);
  const composeModeRef = useRef(composeMode);
  composeModeRef.current = composeMode;
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const sendProgress = useSendProgressDock();
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const canSendInvoices = useMemberCapability("proposals.send");
  const canReplyAndCharge = canManageTickets && canSendInvoices;

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

  const { data: deliverables = [] } = useGetList<TicketDeliverable>(
    "ticket_deliverables",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: Boolean(ticket.id) },
  );

  const unbilledDeliverables = useMemo(
    () => deliverables.filter((file) => !file.invoiced_invoice_id),
    [deliverables],
  );
  const deliverablesReadyForInvoice =
    allDeliverablesHaveBilling(unbilledDeliverables);
  const isInvoiceReply =
    composeMode === "reply" && replySendIntent === "reply_and_invoice";

  const invoiceBlocksSend =
    invoice?.status === "sent" || invoice?.status === "paid";
  const canCreateInvoice =
    unbilledDeliverables.length > 0 &&
    deliverablesReadyForInvoice &&
    ticket.delivery_status !== "delivered" &&
    !invoiceBlocksSend;

  const awaitingPaidDelivery = isTicketAwaitingPaidDelivery(ticket, invoice);
  const outboundAttachmentsAllowed = canSendTicketOutboundAttachments(
    ticket,
    invoice,
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

  const replyKeepStatus = useMemo(
    () => normalizeTicketWorkflowStatus(ticket.status),
    [ticket.status],
  );

  const replyStatusTransitions = useMemo(
    () => getTicketReplyStatusTransitions(ticket.status),
    [ticket.status],
  );

  const activeInbox = useMemo(() => {
    const targetEmail = (
      ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL
    ).toLowerCase();
    return (
      ticketInboxes.find(
        (entry) => entry.email?.trim().toLowerCase() === targetEmail,
      ) ??
      ticketInboxes[0] ??
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

  const lastInboundMessage = useMemo(
    () =>
      recentMessages.find((message) => message.direction === "inbound") ?? null,
    [recentMessages],
  );

  const ticketInboxEmails = useMemo(
    () => ticketInboxes.map((inbox) => inbox.email),
    [ticketInboxes],
  );

  /** Prefer the sender of the latest inbound email (Gmail-style Reply). */
  const defaultRecipientEmail = useMemo(
    () =>
      resolveTicketReplyRecipientEmail({
        ticket,
        company,
        contact,
        recentMessages,
        inboxEmails: ticketInboxEmails,
      }),
    [ticket, company, contact, recentMessages, ticketInboxEmails],
  );

  const buildReplyHtmlWithQuote = useCallback(
    (quotedMessage?: TicketMessage | null) => {
      const quotedHtml = quotedMessage
        ? buildQuotedReplyEditorHtml(quotedMessage)
        : "";
      return createDefaultReplyHtml(inboxSignature, quotedHtml);
    },
    [inboxSignature],
  );

  const defaultReplyHtml = useMemo(
    () => buildReplyHtmlWithQuote(lastInboundMessage),
    [buildReplyHtmlWithQuote, lastInboundMessage],
  );

  const forwardSourceMessage =
    recentMessages.find((message) => message.direction === "inbound") ??
    recentMessages[0];

  const replyMinHeight = isDock
    ? composeMode === "forward"
      ? 120
      : 240
    : composeMode === "forward"
      ? 80
      : 140;
  const replyMaxHeight = isDock
    ? composeMode === "forward"
      ? 320
      : 520
    : composeMode === "forward"
      ? 240
      : 480;

  const fromAddress =
    ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const readyPendingFiles = pendingFiles.filter(
    (entry) => entry.status === "ready" && entry.uploaded,
  );
  const attachmentsUploading = pendingFiles.some(
    (entry) => entry.status === "uploading",
  );
  const attachmentsErrored = pendingFiles.some(
    (entry) => entry.status === "error",
  );
  const hasContent =
    composeMode === "internal"
      ? Boolean(internalNoteText.trim()) || readyPendingFiles.length > 0
      : (composeMode === "forward" && forwardContext != null) ||
        hasReplyContentHtml(bodyHtml) ||
        readyPendingFiles.length > 0;

  const composerTabSummary = useMemo(() => {
    const truncate = (value: string, max = 72) => {
      const normalized = value.replace(/\s+/g, "").trim();
      if (!normalized) return "";
      return normalized.length > max
        ? `${normalized.slice(0, max)}…`
        : normalized;
    };

    const attachmentHint =
      readyPendingFiles.length > 0
        ? `${readyPendingFiles.length} attachment${readyPendingFiles.length === 1 ? "" : "s"}`
        : attachmentsUploading
          ? "Uploading attachments…"
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
        htmlToPlainText(stripReplyComposerMetaHtml(bodyHtml)),
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
      htmlToPlainText(stripReplyComposerMetaHtml(bodyHtml)),
      80,
    );

    return {
      title:
        replySendIntent === "reply_and_invoice" ? "Reply & Invoice" : "Reply",
      context: recipient.includes("@") ? `To ${recipient}` : recipient,
      preview: preview || attachmentHint || "Empty draft",
    };
  }, [
    bodyHtml,
    composeMode,
    defaultRecipientEmail,
    internalNoteText,
    pendingFiles.length,
    readyPendingFiles.length,
    attachmentsUploading,
    replySendIntent,
    toRecipients,
  ]);

  const resetDraft = () => {
    setBodyHtml(defaultReplyHtml);
    setInternalNoteText("");
    setForwardContext(null);
    setReplySendIntent("reply");
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
    setShowCc(false);
    setComposeMode("reply");
    setForwardContext(null);
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

  const openComposer = useCallback(
    (mode: ComposeMode, options?: { replyIntent?: ReplySendIntent }) => {
      setComposeMode(mode);
      setReplySendIntent(
        mode === "reply" ? (options?.replyIntent ?? "reply") : "reply",
      );
      setIsExpanded(true);
      setIsMinimized(false);
      setCcRecipients("");
      setShowCc(false);
      setPendingFiles((current) => {
        current.forEach((entry) => {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        });
        return [];
      });

      if (mode === "reply") {
        setForwardContext(null);
        setToRecipients(defaultRecipientEmail);
        setBodyHtml(buildReplyHtmlWithQuote(lastInboundMessage));
        if (options?.replyIntent === "reply_and_invoice") {
          setShowInvoiceNote(false);
        }
      } else if (mode === "internal") {
        setForwardContext(null);
        setInternalNoteText("");
      } else {
        setForwardContext(
          forwardSourceMessage ? { message: forwardSourceMessage } : null,
        );
        setToRecipients("");
        setBodyHtml(defaultReplyHtml);
      }

      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [
      buildReplyHtmlWithQuote,
      defaultRecipientEmail,
      defaultReplyHtml,
      forwardSourceMessage,
      lastInboundMessage,
      ticket.id,
    ],
  );

  const startReplyAndInvoice = useCallback(() => {
    setComposeMode("reply");
    setReplySendIntent("reply_and_invoice");
    setShowInvoiceNote(false);
    setIsExpanded(true);
    setIsMinimized(false);
  }, []);

  useImperativeHandle(ref, () => ({ openComposer }), [openComposer]);

  useEffect(() => {
    if (!defaultRecipientEmail) return;
    setToRecipients((current) => current.trim() || defaultRecipientEmail);
  }, [defaultRecipientEmail]);

  useEffect(() => {
    setIsExpanded(false);
    setIsMinimized(false);
    setShowCc(false);
    setShowInvoiceNote(false);
    setComposeMode("reply");
    setReplySendIntent("reply");
    resetDraft();
    // placement kept in deps so HMR never changes array length (top ↔ dock).
  }, [ticket.id, defaultRecipientEmail, defaultReplyHtml, placement]);

  useEffect(() => {
    if (!quoteMessage) return;
    const fromEmail = quoteMessage.from_email?.trim().toLowerCase();
    setComposeMode("reply");
    setReplySendIntent("reply");
    setIsExpanded(true);
    setIsMinimized(false);
    setShowInvoiceNote(false);
    // Reply to this message only: To = sender, quote = that email.
    if (fromEmail) setToRecipients(fromEmail);
    setBodyHtml(buildReplyHtmlWithQuote(quoteMessage));
    onQuoteApplied?.();
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [quoteMessage, onQuoteApplied, buildReplyHtmlWithQuote]);

  const uploadPendingFile = useCallback(async (id: string, file: File) => {
    const upload =
      composeModeRef.current === "internal"
        ? uploadTicketAttachmentWithProgress
        : uploadTicketReplyAttachmentWithProgress;

    try {
      const uploaded = await upload(file, (progress) => {
        setPendingFiles((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, progress } : entry,
          ),
        );
      });

      setPendingFiles((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "ready",
                progress: 100,
                uploaded,
                errorMessage: undefined,
              }
            : entry,
        ),
      );
    } catch (error) {
      setPendingFiles((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "error",
                progress: 0,
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : "Failed to upload attachment",
              }
            : entry,
        ),
      );
    }
  }, []);

  const addPendingFile = (file: File) => {
    if (pendingFiles.length >= MAX_TICKET_ATTACHMENTS) {
      notify(`You can attach up to ${MAX_TICKET_ATTACHMENTS} files`, {
        type: "warning",
      });
      return;
    }
    if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
      notify(
        `"${file.name}" exceeds the ${ticketAttachmentLimitLabel(MAX_TICKET_ATTACHMENT_BYTES)} limit`,
        { type: "error" },
      );
      return;
    }
    if (
      composeMode !== "internal" &&
      shouldSendTicketReplyAttachmentAsLink(
        file.size,
        replyAttachmentLimitBytes,
      )
    ) {
      notify(
        `"${file.name}" will be sent as a download link (expires in 7 days)`,
        { type: "info" },
      );
    }

    const id = crypto.randomUUID();
    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
    setPendingFiles((current) => [
      ...current,
      {
        id,
        file,
        previewUrl,
        status: "uploading",
        progress: 0,
      },
    ]);
    void uploadPendingFile(id, file);
  };

  const retryPendingFile = (id: string) => {
    const target = pendingFiles.find((entry) => entry.id === id);
    if (!target) return;

    setPendingFiles((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "uploading",
              progress: 0,
              errorMessage: undefined,
              uploaded: undefined,
            }
          : entry,
      ),
    );
    void uploadPendingFile(id, target.file);
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
      const uploadedAttachments: TicketReplyAttachment[] = readyPendingFiles
        .map((entry) => {
          const uploaded = entry.uploaded;
          if (!uploaded) return null;
          const asLink =
            !isInternalNote &&
            shouldSendTicketReplyAttachmentAsLink(
              entry.file.size,
              replyAttachmentLimitBytes,
            );
          return asLink
            ? { ...uploaded, send_as_download_link: true }
            : uploaded;
        })
        .filter((entry): entry is TicketReplyAttachment => Boolean(entry));

      const attachmentCount = uploadedAttachments.length;
      sendProgress.begin(
        isInternalNote ? "Saving internal note" : "Sending reply",
        [
          ...(attachmentCount > 0
            ? [
                {
                  id: "attachments",
                  label: `Attachments (${attachmentCount})`,
                },
              ]
            : []),
          {
            id: "send",
            label: isInternalNote ? "Save internal note" : "Send email",
          },
          { id: "save", label: "Save on ticket" },
        ],
      );
      if (attachmentCount > 0) {
        sendProgress.runStep("attachments");
        await paintSendProgress();
        sendProgress.completeStep(
          "attachments",
          `${attachmentCount} file${attachmentCount === 1 ? "" : "s"} ready`,
        );
      }
      sendProgress.runStep("send");
      sendProgress.runStep("save");

      try {
        const result = await dataProvider.replyTicket({
          ticketId: ticket.id,
          body: messageBody,
          htmlBody,
          isInternalNote,
          attachments: uploadedAttachments,
          toEmails,
          ccEmails,
          nextStatus,
        });
        if (isInternalNote || result.is_internal_note) {
          sendProgress.completeStep("send", "Saved for the team");
        } else if (result.email_sent) {
          sendProgress.completeStep(
            "send",
            toEmails?.length ? toEmails.join(", ") : undefined,
          );
        } else if (result.email_skipped) {
          sendProgress.skipStep(
            "send",
            "Email skipped — check Communications settings",
          );
        } else {
          sendProgress.completeStep("send");
        }
        sendProgress.completeStep("save");
        sendProgress.succeed(
          isInternalNote || result.is_internal_note
            ? "Internal note saved"
            : result.email_sent
              ? "Reply sent successfully"
              : result.email_skipped
                ? "Saved — email was not sent"
                : "Reply saved",
        );
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send message";
        sendProgress.failStep("send", message);
        throw error;
      }
    },
    onSuccess: () => {
      setIsExpanded(false);
      setIsMinimized(false);
      resetDraft();
      refresh();
      onSent?.();
      // Success / skip details live in SendProgressDock — no toast globes.
    },
    // Errors surface in SendProgressDock — no duplicate toast.
    onError: () => undefined,
    onSettled: () => setSubmittingAs(null),
  });

  const handleSend = ({
    isInternalNote,
    nextStatus,
  }: {
    isInternalNote: boolean;
    nextStatus?: TicketWorkflowStatus;
  }) => {
    if (attachmentsUploading) {
      notify("Wait until attachments finish uploading", { type: "warning" });
      return;
    }

    if (attachmentsErrored) {
      notify("Remove or retry failed attachments before sending", {
        type: "warning",
      });
      return;
    }

    if (!hasContent) {
      notify("Add a message or attach a file", { type: "warning" });
      return;
    }

    if (isInternalNote) {
      const noteBody = internalNoteText.trim();
      if (!noteBody && readyPendingFiles.length === 0) {
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
    const userNoteHtml = extractReplyComposerParts(expandedHtml).userNoteHtml;

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
      toEmails.some((email) =>
        isTicketInboxRecipient(email, ticket, ticketInboxEmails),
      )
    ) {
      notify(
        "To cannot be your ticket inbox. Use the client's email address.",
        { type: "error" },
      );
      return;
    }

    if (readyPendingFiles.length > 0 && !outboundAttachmentsAllowed) {
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

    const { textBody, htmlBody } = buildReplyOutboundBodiesFromHtml(
      expandedHtml,
      inboxSignature,
    );
    setSubmittingAs(nextStatus ?? replyKeepStatus);
    submitMutation.mutate({
      isInternalNote: false,
      messageBody: textBody,
      htmlBody,
      toEmails,
      ccEmails: ccEmails.length ? ccEmails : undefined,
      nextStatus,
    });
  };

  const handleCreateInvoice = () => {
    invoiceSectionRef.current?.openInvoicePreview();
  };

  const handleInvoiceSent = () => {
    setIsExpanded(false);
    setIsMinimized(false);
    setReplySendIntent("reply");
    setShowInvoiceNote(false);
    resetDraft();
    refresh();
    onSent?.();
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
  const slideAnimationClass = isDock
    ? "animate-in slide-in-from-bottom-3 fade-in duration-200"
    : placement === "bottom"
      ? "animate-in slide-in-from-bottom-2 duration-200"
      : "animate-in slide-in-from-top-2 duration-200";

  const minimizeButton = (
    <IconButton
      className="shrink-0 text-muted-foreground"
      disabled={isPending}
      aria-label="Minimize"
      onClick={minimizeComposer}
    >
      <ChevronDown className="size-4" />
    </IconButton>
  );

  const defaultRecipientLabel =
    toRecipients.trim() || defaultRecipientEmail || "Add recipient";
  const replyPlaceholder = `Reply to ${defaultRecipientLabel.includes("@") ? defaultRecipientLabel : defaultRecipientLabel || "client"}`;

  const composerShellClass = cn(
    isDock &&
      "overflow-hidden rounded-xl border border-border bg-background shadow-2xl",
    isDock && !isMinimized && "w-[min(100vw-1.5rem,40rem)]",
    isDock && isMinimized && "w-[min(100vw-1.5rem,17rem)]",
    placement === "top" &&
      "overflow-hidden rounded-lg border border-border/80 bg-background shadow-sm",
  );

  const showModeTabs = placement === "top";
  const modeTabs = showModeTabs ? (
    <TicketComposerModeTabs
      mode={composeMode === "internal" ? "private" : "public"}
      onChange={(next) =>
        openComposer(next === "private" ? "internal" : "reply")
      }
    />
  ) : null;

  // Dock: hidden until Reply / Internal / Forward — Gmail-style floating compose.
  if (!isExpanded) {
    if (isDock) {
      return <>{sendProgress.dock}</>;
    }
    return (
      <>
        {sendProgress.dock}
        <div
          className={cn(
            "flex justify-start bg-background px-4 py-2.5 md:px-5",
            edgeBorderClass,
          )}
        >
          <button
            type="button"
            className="flex w-full max-w-md items-center gap-2.5 rounded-lg border border-border/80 bg-muted/35 px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-muted/55 sm:w-auto sm:min-w-[17rem]"
            onClick={() => openComposer("reply")}
          >
            <Reply className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">
              {replyPlaceholder}
            </span>
          </button>
        </div>
      </>
    );
  }

  if (isMinimized) {
    return (
      <>
        {sendProgress.dock}
        <div
          className={cn(
            isDock || placement === "top"
              ? composerShellClass
              : "bg-background",
            !isDock && placement !== "top" && edgeBorderClass,
          )}
        >
          <div className="flex w-full items-stretch overflow-hidden">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
              onClick={expandComposer}
            >
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-snug text-foreground">
                  {composerTabSummary.title}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {composerTabSummary.context}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {composerTabSummary.preview}
                </p>
              </div>
            </button>
            <IconButton
              className="size-auto w-9 shrink-0 rounded-none border-l border-border/60 hover:bg-muted/70"
              aria-label="Close draft"
              onClick={(event) => {
                event.stopPropagation();
                collapseComposer();
              }}
            >
              <X className="size-4" />
            </IconButton>
          </div>
        </div>
      </>
    );
  }

  if (composeMode === "internal") {
    return (
      <>
        {sendProgress.dock}
        <div
          className={cn(
            isDock || placement === "top"
              ? composerShellClass
              : "shrink-0 bg-background",
            !isDock && placement !== "top" && edgeBorderClass,
          )}
        >
          <div
            className={cn(
              "overflow-hidden bg-amber-50/50 dark:bg-amber-950/20",
              slideAnimationClass,
            )}
          >
            {modeTabs}
            <div className="flex items-center justify-between gap-2 px-3 py-2 md:px-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                <Lock className="size-3.5 shrink-0" />
                Private comment
                <span className="font-normal text-muted-foreground">
                  · team only
                </span>
              </p>
              <div className="flex items-center gap-0.5">
                {minimizeButton}
                {isDock ? (
                  <IconButton
                    className="shrink-0 text-muted-foreground"
                    disabled={isPending}
                    aria-label="Close"
                    onClick={collapseComposer}
                  >
                    <X className="size-4" />
                  </IconButton>
                ) : null}
              </div>
            </div>

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
              placeholder="Add a note…"
              rows={3}
              disabled={isPending}
              className="min-h-[4.5rem] resize-y rounded-none border-0 border-t border-amber-500/20 bg-background px-4 py-2.5 text-sm shadow-none focus-visible:ring-0 md:px-5"
              autoFocus
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const files = Array.from(event.dataTransfer.files ?? []);
                files.forEach(addPendingFile);
              }}
            />

            {pendingFiles.length > 0 ? (
              <div className="flex flex-col gap-1.5 px-3 py-2 md:px-4">
                {pendingFiles.map((pending) => (
                  <TicketPendingAttachmentItem
                    key={pending.id}
                    pending={pending}
                    disabled={isPending}
                    onRemove={() => removePendingFile(pending.id)}
                    onRetry={() => retryPendingFile(pending.id)}
                  />
                ))}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 bg-background px-4 py-2 md:px-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                disabled={isPending || attachmentsUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Attach
                {pendingFiles.length > 0 ? (
                  <span className="tabular-nums">({pendingFiles.length})</span>
                ) : null}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  disabled={isPending}
                  onClick={collapseComposer}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isPending || attachmentsUploading || !hasContent}
                  onClick={() => handleSend({ isInternalNote: true })}
                >
                  {submittingAs === "internal" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {sendProgress.dock}
      <div
        className={cn(
          isDock || placement === "top"
            ? composerShellClass
            : "shrink-0 bg-background",
          !isDock && placement !== "top" && edgeBorderClass,
        )}
      >
        <div
          className={cn(
            "flex max-h-[min(78vh,42rem)] flex-col overflow-hidden bg-background",
            isDock && "min-h-[28rem]",
            slideAnimationClass,
          )}
        >
          {modeTabs}
          {isDock ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
              <p className="truncate text-sm font-medium">
                {composeMode === "forward" ? "Forward" : "Reply"}
              </p>
              <div className="flex items-center gap-0.5">
                {minimizeButton}
                <IconButton
                  className="shrink-0 text-muted-foreground"
                  disabled={isPending}
                  aria-label="Close"
                  onClick={collapseComposer}
                >
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>
          ) : null}
          <div className="shrink-0 border-b px-3 py-1.5 md:px-4">
            <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-sm">
              {!isDock && placement !== "top" ? (
                <>
                  <span className="text-xs text-muted-foreground">From</span>
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {fromAddress}
                  </span>
                  {minimizeButton}
                </>
              ) : null}

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
                placeholder="Add recipient"
                disabled={isPending}
                variant={isDock ? "plain" : "boxed"}
                className="min-w-0 w-full shadow-none"
              />
              {!showCc ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-end h-auto px-1 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                  disabled={isPending}
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              ) : (
                <span />
              )}

              {showCc ? (
                <>
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
                    placeholder="Add Cc"
                    disabled={isPending}
                    variant={isDock ? "plain" : "boxed"}
                    className="min-w-0 w-full shadow-none"
                  />
                  <span />
                </>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {isInvoiceReply ? (
              <TicketReplyInvoiceSection
                ref={invoiceSectionRef}
                ticket={ticket}
                invoice={invoice}
                company={company}
                contact={contact}
                deliverables={deliverables}
                unbilledDeliverables={unbilledDeliverables}
                deliverablesReadyForInvoice={deliverablesReadyForInvoice}
                onInvoiceSent={handleInvoiceSent}
              />
            ) : null}

            {awaitingPaidDelivery ? (
              <p className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-xs text-foreground">
                {TICKET_AWAITING_PAYMENT_ATTACHMENT_HINT}
              </p>
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

            {isInvoiceReply ? (
              <div className="flex items-center border-b px-4 py-2 md:px-5">
                {showInvoiceNote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => setShowInvoiceNote(false)}
                  >
                    Hide note
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-muted-foreground"
                    onClick={() => {
                      setShowInvoiceNote(true);
                      requestAnimationFrame(() => editorRef.current?.focus());
                    }}
                  >
                    Add a personal note (optional)
                  </Button>
                )}
              </div>
            ) : null}

            {!isInvoiceReply || showInvoiceNote ? (
              <>
                {!isDock ? (
                  <TicketComposerToolbar
                    editorRef={editorRef}
                    onEditorChange={(userHtml) => {
                      setBodyHtml((current) => {
                        const { signatureHtml, quotedReplyHtml } =
                          extractReplyComposerParts(current);
                        return assembleReplyComposerHtml({
                          userNoteHtml: userHtml,
                          signatureHtml,
                          quotedReplyHtml,
                        });
                      });
                    }}
                    disabled={isPending}
                    ticket={ticket}
                    inbox={activeInbox}
                    contact={contact}
                    company={company}
                    onInsertTemplate={handleInsertTemplate}
                    attachLabel="Attach"
                    showLargeFileTransfer={false}
                    onAttachClick={() => fileInputRef.current?.click()}
                  />
                ) : null}

                <TicketReplyRichComposer
                  editorRef={editorRef}
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  onPaste={handlePaste}
                  placeholder={
                    composeMode === "forward"
                      ? "Add a note above the forwarded message..."
                      : isInvoiceReply
                        ? "Add an optional note for the client..."
                        : "Write your reply..."
                  }
                  disabled={isPending}
                  minHeight={replyMinHeight}
                  maxHeight={replyMaxHeight}
                  resizeTrigger={isExpanded}
                  collapseQuotedByDefault={isDock || composeMode === "reply"}
                  className={
                    composeMode === "forward"
                      ? "min-h-20"
                      : isDock
                        ? "min-h-[14rem]"
                        : "min-h-[7rem]"
                  }
                  attachments={
                    pendingFiles.length > 0
                      ? pendingFiles.map((pending) => (
                          <TicketPendingAttachmentItem
                            key={pending.id}
                            pending={pending}
                            disabled={isPending}
                            onRemove={() => removePendingFile(pending.id)}
                            onRetry={() => retryPendingFile(pending.id)}
                            sendAsDownloadLink={shouldSendTicketReplyAttachmentAsLink(
                              pending.file.size,
                              replyAttachmentLimitBytes,
                            )}
                          />
                        ))
                      : undefined
                  }
                />
              </>
            ) : null}

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
          </div>

          <TicketReplyComposerActions
            className="shrink-0"
            composeMode={composeMode}
            currentStatus={replyKeepStatus}
            statusTransitions={replyStatusTransitions}
            disabled={isPending || attachmentsUploading}
            hasContent={hasContent}
            submittingAs={submittingAs}
            showReplyAndCharge={canReplyAndCharge}
            invoiceComposerMode={isInvoiceReply}
            canCreateInvoice={canCreateInvoice}
            preferReplyAndCharge={replySendIntent === "reply_and_invoice"}
            leading={
              isDock && (!isInvoiceReply || showInvoiceNote) ? (
                <TicketComposerToolbar
                  variant="inline"
                  editorRef={editorRef}
                  onEditorChange={(userHtml) => {
                    setBodyHtml((current) => {
                      const { signatureHtml, quotedReplyHtml } =
                        extractReplyComposerParts(current);
                      return assembleReplyComposerHtml({
                        userNoteHtml: userHtml,
                        signatureHtml,
                        quotedReplyHtml,
                      });
                    });
                  }}
                  disabled={isPending}
                  ticket={ticket}
                  inbox={activeInbox}
                  contact={contact}
                  company={company}
                  onInsertTemplate={handleInsertTemplate}
                  attachLabel="Attach"
                  showLargeFileTransfer={false}
                  onAttachClick={() => fileInputRef.current?.click()}
                />
              ) : undefined
            }
            onCancel={collapseComposer}
            onSendReply={(nextStatus) =>
              handleSend({ isInternalNote: false, nextStatus })
            }
            onCreateInvoice={handleCreateInvoice}
            onStartReplyAndInvoice={startReplyAndInvoice}
            onSendForward={() => handleSend({ isInternalNote: false })}
          />
        </div>
      </div>
    </>
  );
});
