import { CaretLeft, Ticket } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotify } from "ra-core";
import { isMailTicketBridgeEnabled } from "@/lib/featureFlags";
import { useMailMessages } from "./useMailThreads";
import { sanitizeMailHtml } from "./sanitizeMailHtml";
import type { MailThread } from "./types";

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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/15 p-3 md:p-4">
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this thread.</p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm"
            >
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-xs text-muted-foreground">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
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
                // Always render HTML on a light canvas (Gmail-style) so
                // marketing backgrounds stay inside the message, not the CRM chrome.
                <div className="mt-1 overflow-hidden rounded-md border border-black/10 bg-white text-neutral-900 shadow-sm isolate">
                  <div
                    className="mail-html-canvas max-w-none overflow-x-auto p-3 text-[13px] leading-normal [&_a]:text-blue-700 [&_img]:h-auto [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeMailHtml(message.body_html),
                    }}
                  />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {message.body_text || ""}
                </pre>
              )}
            </article>
          ))
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
