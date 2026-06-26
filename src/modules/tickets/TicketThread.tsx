import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { ChevronDown, Lock, Reply } from "lucide-react";
import type { FileAttachment } from "@/lib/fileAttachments";
import type { TicketMessage } from "@/modules/types";
import { EmailDeliveryBadge } from "@/modules/tickets/EmailDeliveryBadge";
import {
  TicketInternalNoteActions,
  TicketInternalNoteEditor,
} from "@/modules/tickets/TicketInternalNoteEditor";
import { TicketMessageContent } from "@/modules/tickets/TicketMessageContent";
import { useTicketReadCutoff } from "@/modules/tickets/TicketReadCutoffContext";
import { useTicketThreadQuote } from "@/modules/tickets/TicketThreadQuoteContext";
import { isInboundMessageUnread } from "@/modules/tickets/ticketReadState";
import { formatTicketMessageTime } from "@/modules/tickets/ticketInboxUi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PREVIEW_MAX_LENGTH = 140;

const getMessagePreview = (message: TicketMessage) => {
  const source = message.body?.trim() || message.html_body || "";
  const text = source
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "No message content";
  if (text.length <= PREVIEW_MAX_LENGTH) return text;
  return `${text.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
};

const formatRecipientList = (emails?: string[] | null) => {
  const list = (emails ?? []).map((email) => email.trim()).filter(Boolean);
  if (!list.length) return null;
  return list.join(", ");
};

const TicketThreadMessage = ({
  message,
  collapsed,
  onToggle,
  isLatest,
}: {
  message: TicketMessage;
  collapsed: boolean;
  onToggle: () => void;
  isLatest: boolean;
}) => {
  const readCutoff = useTicketReadCutoff();
  const quoteContext = useTicketThreadQuote();
  const [isEditingInternal, setIsEditingInternal] = useState(false);
  const inbound = message.direction === "inbound";
  const isInternal = message.direction === "internal";
  const outbound = message.direction === "outbound";
  const senderEmail = message.from_email?.trim();
  const senderName = message.from_name?.trim();
  const senderLabel =
    senderEmail && senderName
      ? `${senderEmail} · ${senderName}`
      : senderEmail || senderName || (inbound ? "Customer" : "Team");

  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as FileAttachment[])
    : [];
  const preview = useMemo(() => getMessagePreview(message), [message]);
  const toLine = formatRecipientList(message.to_emails);
  const ccLine = formatRecipientList(message.cc_emails);

  const handleQuote = () => {
    quoteContext?.quoteMessage(message);
  };

  useEffect(() => {
    setIsEditingInternal(false);
  }, [message.id]);

  if (isInternal) {
    const author = senderName || "Team";

    return (
      <article className="group/internal mx-auto w-full max-w-3xl border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground last:border-b-0 md:px-5">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => !isEditingInternal && onToggle()}
            disabled={isEditingInternal}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 uppercase tracking-wide text-warning">
                <Lock className="size-3.5 shrink-0" />
                Internal note
              </span>
              <span aria-hidden>·</span>
              <span className="font-semibold normal-case tracking-normal text-foreground">
                {author}
              </span>
              <span className="shrink-0 normal-case tracking-normal">
                {formatTicketMessageTime(message.created_at)}
              </span>
            </div>
            {collapsed && !isEditingInternal ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {preview}
              </p>
            ) : null}
          </button>
          {!isEditingInternal ? (
            <>
              <TicketInternalNoteActions
                onEdit={() => setIsEditingInternal(true)}
              />
              <button
                type="button"
                className="shrink-0 p-0.5 text-muted-foreground"
                onClick={onToggle}
                aria-label={collapsed ? "Expand note" : "Collapse note"}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    !collapsed && "rotate-180",
                  )}
                />
              </button>
            </>
          ) : null}
        </div>
        {isEditingInternal ? (
          <TicketInternalNoteEditor
            message={message}
            onDone={() => setIsEditingInternal(false)}
          />
        ) : !collapsed ? (
          <>
            {toLine || ccLine ? (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {toLine ? (
                  <p>
                    <span className="font-medium text-foreground/80">To:</span>{" "}
                    {toLine}
                  </p>
                ) : null}
                {ccLine ? (
                  <p>
                    <span className="font-medium text-foreground/80">Cc:</span>{" "}
                    {ccLine}
                  </p>
                ) : null}
              </div>
            ) : null}
            <TicketMessageContent
              body={message.body}
              htmlBody={message.html_body}
              attachments={attachments}
              className="mt-2 text-foreground [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            />
          </>
        ) : null}
      </article>
    );
  }

  const unreadInbound = isInboundMessageUnread(message, readCutoff);

  return (
    <article
      className={cn(
        "group/message flex w-full",
        outbound ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "w-full max-w-[min(100%,42rem)] border-b px-4 py-3 text-sm transition-colors last:border-b-0 md:px-5",
          inbound
            ? unreadInbound
              ? "border-info/40 bg-info/10"
              : "border-border/70 bg-muted/20 dark:bg-muted/35"
            : "border-info/30 bg-info/5",
        )}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={onToggle}
          >
            <div className="flex items-start justify-between gap-3 text-xs">
              <span
                className={cn(
                  "min-w-0 truncate font-semibold",
                  inbound ? "text-foreground" : "text-info",
                )}
              >
                {senderLabel}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {outbound ? (
                  <EmailDeliveryBadge message={message} compact />
                ) : null}
                {formatTicketMessageTime(message.created_at)}
              </span>
            </div>
            {collapsed ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {preview}
              </p>
            ) : null}
          </button>
          {inbound && quoteContext ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 transition-opacity group-hover/message:opacity-100"
              aria-label="Quote reply"
              onClick={handleQuote}
            >
              <Reply className="size-3.5" />
            </Button>
          ) : null}
          <button
            type="button"
            className="shrink-0 p-0.5 text-muted-foreground"
            onClick={onToggle}
            aria-label={collapsed ? "Expand message" : "Collapse message"}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                !collapsed && "rotate-180",
              )}
            />
          </button>
        </div>

        {!collapsed ? (
          <>
            {toLine || ccLine ? (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {toLine ? (
                  <p>
                    <span className="font-medium text-foreground/80">To:</span>{" "}
                    {toLine}
                  </p>
                ) : null}
                {ccLine ? (
                  <p>
                    <span className="font-medium text-foreground/80">Cc:</span>{" "}
                    {ccLine}
                  </p>
                ) : null}
              </div>
            ) : null}
            <TicketMessageContent
              body={message.body}
              htmlBody={message.html_body}
              attachments={attachments}
              className="mt-2 text-foreground"
            />
            {isLatest && outbound ? (
              <div className="mt-2">
                <EmailDeliveryBadge message={message} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
};

export const TicketThread = ({
  messages,
  isPending = false,
  threadEndRef,
}: {
  messages: TicketMessage[];
  isPending?: boolean;
  threadEndRef?: RefObject<HTMLDivElement | null>;
}) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(
    () => new Set(),
  );

  const messageIds = useMemo(
    () => messages.map((message) => Number(message.id)).filter(Number.isFinite),
    [messages],
  );

  useEffect(() => {
    if (messageIds.length <= 1) {
      setCollapsedIds(new Set());
      return;
    }
    setCollapsedIds(new Set(messageIds.slice(0, -1)));
  }, [messageIds.join(",")]);

  const toggleMessage = (messageId: number) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  if (isPending) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading messages…
      </p>
    );
  }

  if (!messages.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages on this ticket yet.
      </p>
    );
  }

  const latestId = messageIds[messageIds.length - 1];

  return (
    <div className="flex flex-col">
      {messages.map((message) => {
        const messageId = Number(message.id);
        return (
          <TicketThreadMessage
            key={message.id}
            message={message}
            collapsed={collapsedIds.has(messageId)}
            onToggle={() => toggleMessage(messageId)}
            isLatest={messageId === latestId}
          />
        );
      })}
      <div ref={threadEndRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
};
