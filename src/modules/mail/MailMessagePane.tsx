import { useMemo } from "react";
import { CaretLeft, File, FilePdf, Ticket } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotify } from "ra-core";
import { isMailTicketBridgeEnabled } from "@/lib/featureFlags";
import { useMailAttachments, useMailMessages } from "./useMailThreads";
import { sanitizeMailHtml } from "./sanitizeMailHtml";
import type { MailAttachment, MailThread } from "./types";

function formatBytes(size: number | null) {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ file }: { file: MailAttachment }) {
  const lower = file.filename.toLowerCase();
  const isPdf =
    (file.mime_type ?? "").includes("pdf") || lower.endsWith(".pdf");
  return (
    <li className="flex items-center gap-2 rounded-md border border-black/10 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800">
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
    </li>
  );
}

export function MailMessagePane({
  thread,
  onReply,
  onReplyAll,
  onForward,
  onBack,
}: {
  thread: MailThread | null;
  onReply: () => void;
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b px-3 py-3 md:px-4">
        {onBack ? (
          <IconButton
            aria-label="Back to list"
            className="mt-0.5 md:hidden"
            onClick={onBack}
          >
            <CaretLeft className="size-4" />
          </IconButton>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-snug">
            {thread.subject || "(No subject)"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thread.message_count} message
            {thread.message_count === 1 ? "" : "s"}
            {thread.is_starred ? " · Starred" : ""}
          </p>
        </div>
        <div className="hidden shrink-0 gap-1 sm:flex">
          {ticketBridge ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={createTicketStub}
            >
              <Ticket className="size-4" />
              Ticket
            </Button>
          ) : null}
          {onForward ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onForward}
            >
              Forward
            </Button>
          ) : null}
          {onReplyAll ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onReplyAll}
            >
              Reply all
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onReply}>
            Reply
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-3 md:p-4">
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this thread.</p>
        ) : (
          messages.map((message) => {
            const files = attachmentsByMessage.get(message.id) ?? [];
            return (
              <article
                key={message.id}
                className="overflow-hidden rounded-lg border border-border/80 bg-white text-neutral-900 shadow-sm isolate"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/5 bg-neutral-50/80 px-4 py-2.5 text-xs text-neutral-600">
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

                {message.body_html ? (
                  <div
                    className="mail-html-canvas overflow-x-auto px-4 py-3 text-[13px] leading-normal"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeMailHtml(message.body_html),
                    }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed text-neutral-900">
                    {message.body_text || ""}
                  </pre>
                )}

                {files.length > 0 ? (
                  <div className="border-t border-black/5 px-4 py-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      {files.length} attachment{files.length === 1 ? "" : "s"}
                    </p>
                    <ul className="space-y-1.5">
                      {files.map((file) => (
                        <AttachmentRow key={file.id} file={file} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      <div className="flex gap-2 border-t p-3 sm:hidden">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={onForward}
        >
          Forward
        </Button>
        <Button type="button" size="sm" className="flex-1" onClick={onReply}>
          Reply
        </Button>
      </div>
    </div>
  );
}
