import { useEffect, useMemo, useState } from "react";
import { useListContext } from "ra-core";
import type { FileAttachment } from "@/lib/fileAttachments";
import type { TicketMessage } from "@/modules/types";
import { TicketMessageContent } from "@/modules/tickets/TicketMessageContent";
import { useTicketReadCutoff } from "@/modules/tickets/TicketReadCutoffContext";
import { isInboundMessageUnread } from "@/modules/tickets/ticketReadState";
import { formatTicketMessageTime } from "@/modules/tickets/ticketInboxUi";
import { cn } from "@/lib/utils";
import { ChevronDown, Lock } from "lucide-react";

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
}: {
  message: TicketMessage;
  collapsed: boolean;
  onToggle: () => void;
}) => {
  const readCutoff = useTicketReadCutoff();
  const inbound = message.direction === "inbound";
  const isInternal = message.direction === "internal";
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

  if (isInternal) {
    const author = senderName || "Team";
    return (
      <article className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm text-foreground last:border-b-0">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          onClick={onToggle}
        >
          <div className="min-w-0 flex-1">
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
            {collapsed ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{preview}</p>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              !collapsed && "rotate-180",
            )}
          />
        </button>
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
        "border-b px-5 py-3 text-sm transition-colors last:border-b-0",
        inbound
          ? unreadInbound
            ? "border-info/40 bg-info/10"
            : "border-border/70 bg-muted/20 dark:bg-muted/35"
          : "border-info/30 bg-info/5",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 text-xs">
            <span
              className={cn(
                "min-w-0 truncate font-semibold",
                inbound ? "text-foreground" : "text-info",
              )}
            >
              {senderLabel}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {formatTicketMessageTime(message.created_at)}
            </span>
          </div>
          {collapsed ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{preview}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            !collapsed && "rotate-180",
          )}
        />
      </button>

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
        </>
      ) : null}
    </article>
  );
};

export const TicketThread = () => {
  const { data = [], isPending } = useListContext<TicketMessage>();
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => new Set());

  const messageIds = useMemo(
    () => data.map((message) => Number(message.id)).filter(Number.isFinite),
    [data],
  );

  useEffect(() => {
    if (messageIds.length <= 1) {
      setCollapsedIds(new Set());
      return;
    }
    setCollapsedIds(new Set(messageIds.slice(1)));
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

  if (isPending) return null;

  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages on this ticket yet.
      </p>
    );
  }

  return (
    <div className="-mx-5 border-y border-border">
      {data.map((message) => {
        const messageId = Number(message.id);
        return (
          <TicketThreadMessage
            key={message.id}
            message={message}
            collapsed={collapsedIds.has(messageId)}
            onToggle={() => toggleMessage(messageId)}
          />
        );
      })}
    </div>
  );
};
