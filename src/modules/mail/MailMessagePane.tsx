import { useMemo, useRef, type RefObject } from "react";
import {
  Archive,
  ArrowBendDoubleUpLeft,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUUpLeft,
  CaretLeft,
  File,
  FilePdf,
  Prohibit,
  Star,
  Ticket,
  Trash,
} from "@phosphor-icons/react";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { isMailTicketBridgeEnabled } from "@/lib/featureFlags";
import { cn } from "@/lib/utils";
import { useMailAttachments, useMailMessages } from "./useMailThreads";
import { MailHtmlBody } from "./MailHtmlBody";
import { isMailRenderDebugEnabled } from "./mailRenderDebug";
import { MailRenderDebugPanel } from "./MailRenderDebugPanel";
import {
  isDownloadableMailAttachment,
  useResolvedMailHtml,
} from "./useMailInlineHtml";
import type { MailAttachment, MailAccount, MailMessage, MailThread } from "./types";
import { MailAccountAvatar } from "./mailAccountAvatar";

export type MailMessagePaneActions = {
  isStarred: boolean;
  onToggleStar?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onRestore?: () => void;
  onMoveToTrash?: () => void;
  onReportSpam?: () => void;
  onNotSpam?: () => void;
  onDeleteForever?: () => void;
};

function formatBytes(size: number | null) {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ file }: { file: MailAttachment }) {
  const notify = useNotify();
  const lower = file.filename.toLowerCase();
  const isPdf =
    (file.mime_type ?? "").includes("pdf") || lower.endsWith(".pdf");

  const openAttachment = async () => {
    if (!file.storage_path?.trim()) {
      notify(
        "This attachment is not stored yet. Try syncing the mailbox again.",
        { type: "info" },
      );
      return;
    }
    const { data, error } = await supabase.storage
      .from("mail-attachments")
      .createSignedUrl(file.storage_path, 3600);
    if (error || !data?.signedUrl) {
      const message = error?.message ?? "Could not open attachment";
      notify(
        /not found/i.test(message)
          ? "Attachment file missing. Try syncing this mailbox again."
          : message,
        { type: "error" },
      );
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => void openAttachment()}
        className="flex w-full items-center gap-2 rounded-md border border-black/10 bg-neutral-50 px-2.5 py-1.5 text-left text-xs text-neutral-800 transition-colors hover:bg-neutral-100"
      >
        {isPdf ? (
          <FilePdf className="size-4 shrink-0 text-red-600" weight="fill" />
        ) : (
          <File className="size-4 shrink-0 text-neutral-500" weight="fill" />
        )}
        <span className="min-w-0 flex-1 truncate">{file.filename}</span>
        {file.size_bytes ? (
          <span className="shrink-0 tabular-nums text-neutral-500">
            {formatBytes(file.size_bytes)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function MessageHeaderActions({
  actions,
  onReply,
  onReplyAll,
  onForward,
  onCreateTicket,
}: {
  actions?: MailMessagePaneActions;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onCreateTicket?: () => void;
}) {
  const hasOrganize =
    actions &&
    (actions.onToggleStar ||
      actions.onArchive ||
      actions.onUnarchive ||
      actions.onRestore ||
      actions.onMoveToTrash ||
      actions.onReportSpam ||
      actions.onNotSpam ||
      actions.onDeleteForever);

  if (!hasOrganize && !onReply && !onReplyAll && !onForward && !onCreateTicket) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5 self-start">
      {onCreateTicket ? (
        <IconButtonWithTooltip
          label="Create ticket"
          className="size-8"
          onClick={onCreateTicket}
        >
          <Ticket className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {onReply ? (
        <IconButtonWithTooltip
          label="Reply"
          className="size-8"
          onClick={onReply}
        >
          <ArrowBendUpLeft className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {onReplyAll ? (
        <IconButtonWithTooltip
          label="Reply all"
          className="size-8"
          onClick={onReplyAll}
        >
          <ArrowBendDoubleUpLeft className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {onForward ? (
        <IconButtonWithTooltip
          label="Forward"
          className="size-8"
          onClick={onForward}
        >
          <ArrowBendUpRight className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onToggleStar ? (
        <IconButtonWithTooltip
          label={actions.isStarred ? "Unstar" : "Star"}
          className="size-8"
          onClick={actions.onToggleStar}
        >
          <Star
            className="size-4"
            weight={actions.isStarred ? "fill" : "regular"}
          />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onRestore ? (
        <IconButtonWithTooltip
          label="Restore to inbox"
          className="size-8"
          onClick={actions.onRestore}
        >
          <ArrowUUpLeft className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onUnarchive ? (
        <IconButtonWithTooltip
          label="Move to inbox"
          className="size-8"
          onClick={actions.onUnarchive}
        >
          <Archive className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onArchive ? (
        <IconButtonWithTooltip
          label="Archive"
          className="size-8"
          onClick={actions.onArchive}
        >
          <Archive className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onReportSpam ? (
        <IconButtonWithTooltip
          label="Report spam"
          className="size-8"
          onClick={actions.onReportSpam}
        >
          <Prohibit className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onNotSpam ? (
        <IconButtonWithTooltip
          label="Not spam"
          className="size-8"
          onClick={actions.onNotSpam}
        >
          <Prohibit className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onMoveToTrash ? (
        <IconButtonWithTooltip
          label="Move to trash"
          className="size-8"
          onClick={actions.onMoveToTrash}
        >
          <Trash className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
      {actions?.onDeleteForever ? (
        <IconButtonWithTooltip
          label="Delete forever"
          className="size-8 text-destructive"
          onClick={actions.onDeleteForever}
        >
          <Trash className="size-4" />
        </IconButtonWithTooltip>
      ) : null}
    </div>
  );
}

function MessageHtmlBody({
  message,
  attachments,
  scrollPaneRef,
}: {
  message: MailMessage;
  attachments: MailAttachment[];
  scrollPaneRef: RefObject<HTMLDivElement | null>;
}) {
  const resolvedHtml = useResolvedMailHtml(message.body_html, attachments);
  if (resolvedHtml) {
    return (
      <MailHtmlBody
        html={resolvedHtml}
        variant="reader"
        layout="auto"
        scrollPaneRef={scrollPaneRef}
      />
    );
  }
  if (message.body_text?.trim()) {
    return (
      <pre className="whitespace-pre-wrap px-3 py-3 font-sans text-sm leading-relaxed text-neutral-900 md:px-4">
        {message.body_text}
      </pre>
    );
  }
  return null;
}

export function MailMessagePane({
  thread,
  threadActions,
  mailboxAccount,
  onReply,
  onReplyAll,
  onForward,
  onBack,
}: {
  thread: MailThread | null;
  threadActions?: MailMessagePaneActions;
  mailboxAccount?: MailAccount | null;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onBack?: () => void;
}) {
  const notify = useNotify();
  const { data: messages = [], isPending } = useMailMessages(thread?.id ?? null);
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const { data: attachments = [] } = useMailAttachments(messageIds);
  const attachmentsByMessage = useMemo(() => {
    const map = new Map<number, MailAttachment[]>();
    for (const file of attachments) {
      const list = map.get(file.message_id) ?? [];
      list.push(file);
      map.set(file.message_id, list);
    }
    return map;
  }, [attachments]);
  const ticketBridge = isMailTicketBridgeEnabled();
  const soleMessage = messages.length === 1 ? messages[0] : null;
  const showRenderDebug = isMailRenderDebugEnabled();
  const debugHtml =
    messages.find((m) => m.body_html?.trim())?.body_html ?? null;
  const scrollPaneRef = useRef<HTMLDivElement>(null);

  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-foreground">No message selected</p>
        <p className="text-sm text-muted-foreground">
          Choose a conversation from the list, or compose a new message.
        </p>
      </div>
    );
  }

  const createTicketStub = () => {
    notify(
      "Create ticket from mail is coming soon. Enable VITE_MAIL_TICKET_BRIDGE when ready.",
      { type: "info" },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-start gap-2 px-3 py-3 md:px-4">
        {onBack ? (
          <IconButtonWithTooltip
            label="Back to list"
            className="mt-0.5 md:hidden"
            onClick={onBack}
          >
            <CaretLeft className="size-4" />
          </IconButtonWithTooltip>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-snug">
            {thread.subject || "(No subject)"}
          </h2>
          {mailboxAccount ? (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <MailAccountAvatar
                account={mailboxAccount}
                size="xs"
                className="ring-1 ring-border/60"
              />
              <span className="truncate">
                {mailboxAccount.display_name?.trim() || mailboxAccount.email}
              </span>
            </p>
          ) : null}
          <p className={cn("text-xs text-muted-foreground", mailboxAccount ? "mt-1" : "mt-0.5")}>
            {soleMessage && !isPending ? (
              <>
                <span className="text-foreground/90">
                  {soleMessage.from_name || soleMessage.from_email || "Unknown"}
                </span>
                {soleMessage.from_name && soleMessage.from_email ? (
                  <span> · {soleMessage.from_email}</span>
                ) : null}
                {soleMessage.sent_at ? (
                  <span>
                    {" · "}
                    {new Date(soleMessage.sent_at).toLocaleString()}
                  </span>
                ) : null}
                {thread.is_starred ? " · Starred" : ""}
              </>
            ) : (
              <>
                {thread.message_count} message
                {thread.message_count === 1 ? "" : "s"}
                {thread.is_starred ? " · Starred" : ""}
              </>
            )}
          </p>
        </div>
        <MessageHeaderActions
          actions={threadActions}
          onReply={onReply}
          onReplyAll={onReplyAll}
          onForward={onForward}
          onCreateTicket={ticketBridge ? createTicketStub : undefined}
        />
      </div>

      {showRenderDebug && debugHtml ? (
        <MailRenderDebugPanel rawHtml={debugHtml} />
      ) : null}

      <div
        ref={scrollPaneRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background"
      >
        {isPending ? (
          <Skeleton className="m-4 h-40 w-auto" />
        ) : messages.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No messages in this thread.
          </p>
        ) : (
          <div
            className={cn(
              "flex min-h-0 w-full flex-col",
              messages.length === 1 ? "" : "divide-y divide-border/30",
            )}
          >
            {messages.map((message, index) => {
              const files = attachmentsByMessage.get(message.id) ?? [];
              const downloadableFiles = files.filter(isDownloadableMailAttachment);
              const showMessageHeader = messages.length > 1;
              return (
                <article
                  key={message.id}
                  className={cn(
                    "flex w-full min-w-0 flex-col text-neutral-900",
                    index > 0 && messages.length > 1 && "pt-0",
                  )}
                >
                  {showMessageHeader ? (
                    <header className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/20 px-3 py-2.5 text-xs text-neutral-600 md:px-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-neutral-900">
                          {message.from_name || message.from_email || "Unknown"}
                        </div>
                        {message.from_email ? (
                          <div className="truncate">{message.from_email}</div>
                        ) : null}
                        {message.to_emails?.length ? (
                          <div className="mt-0.5 truncate">
                            To: {message.to_emails.join(", ")}
                          </div>
                        ) : null}
                      </div>
                      {message.sent_at ? (
                        <time className="shrink-0" dateTime={message.sent_at}>
                          {new Date(message.sent_at).toLocaleString()}
                        </time>
                      ) : null}
                    </header>
                  ) : null}

                  {message.body_html ? (
                    <MessageHtmlBody
                      message={message}
                      attachments={files}
                      scrollPaneRef={scrollPaneRef}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap px-3 py-3 font-sans text-sm leading-relaxed text-neutral-900 md:px-4">
                      {message.body_text || ""}
                    </pre>
                  )}

                  {downloadableFiles.length > 0 ? (
                    <div className="px-3 py-3 md:px-4">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        {downloadableFiles.length} attachment
                        {downloadableFiles.length === 1 ? "" : "s"}
                      </p>
                      <ul className="space-y-1.5">
                        {downloadableFiles.map((file) => (
                          <AttachmentRow key={file.id} file={file} />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
