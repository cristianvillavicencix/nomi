import { useEffect, useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  ChevronDown,
  Lock,
  MoreHorizontal,
  Paperclip,
  Reply,
} from "lucide-react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { TicketMessage } from "@/modules/types";
import { EmailDeliveryBadge } from "@/modules/tickets/EmailDeliveryBadge";
import { TicketInternalNoteEditor } from "@/modules/tickets/TicketInternalNoteEditor";
import { TicketMessageContent } from "@/modules/tickets/TicketMessageContent";
import { useTicketReadCutoff } from "@/modules/tickets/TicketReadCutoffContext";
import { useTicketThreadQuote } from "@/modules/tickets/TicketThreadQuoteContext";
import { isInboundMessageUnread } from "@/modules/tickets/ticketReadState";
import { formatTicketMessageTime } from "@/modules/tickets/ticketInboxUi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PREVIEW_MAX_LENGTH = 140;

/** Compact legacy "Merged tickets: #1 (long subject), …" audit notes. */
const compactMergeAuditNote = (body?: string | null) => {
  const text = body?.trim();
  if (!text) return null;
  const match = text.match(/^Merged tickets:\s*(.+)$/i);
  if (!match) return null;
  const ids = [...match[1].matchAll(/#(\d+)/g)].map((item) => `#${item[1]}`);
  if (!ids.length) return "Merged tickets into this thread.";
  if (ids.length === 1) {
    return `Merged 1 ticket into this thread (${ids[0]}).`;
  }
  return `Merged ${ids.length} tickets into this thread (${ids.join(", ")}).`;
};

const getMessageBodyText = (message: TicketMessage) => {
  const compact = compactMergeAuditNote(message.body);
  if (compact) return compact;
  return message.body?.trim() || message.html_body || "";
};

const getMessagePreview = (message: TicketMessage) => {
  const source = getMessageBodyText(message);
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

type ThreadTreeTone = "default" | "inbound" | "outbound" | "internal" | "unread";

const ThreadTreeGuide = ({
  isFirst,
  isLast,
  tone = "default",
}: {
  isFirst: boolean;
  isLast: boolean;
  tone?: ThreadTreeTone;
}) => (
  <div className="relative w-5 shrink-0 self-stretch" aria-hidden>
    {/* Vertical stem above the node (├ / └) */}
    {!isFirst ? (
      <span className="absolute top-0 left-1/2 h-4 w-px -translate-x-1/2 bg-border" />
    ) : null}
    {/* Vertical stem below the node (continues the tree) */}
    {!isLast ? (
      <span className="absolute top-4 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border" />
    ) : null}
    {/* Horizontal bracket into the message */}
    <span className="absolute top-4 left-1/2 h-px w-2.5 bg-border" />
    <span
      className={cn(
        "absolute top-3 left-1/2 size-2 -translate-x-1/2 rounded-full border-2 bg-background",
        tone === "internal" &&
          "border-amber-500 bg-amber-100 dark:bg-amber-950",
        tone === "unread" && "border-blue-500 bg-blue-100 dark:bg-blue-950",
        tone === "inbound" && "border-slate-400",
        tone === "outbound" && "border-sky-500",
        tone === "default" && "border-muted-foreground/50",
      )}
    />
  </div>
);

const MessageOverflowMenu = ({
  collapsed,
  onToggle,
  onQuote,
  canQuote,
  toLine,
  ccLine,
  showDetails,
  onToggleDetails,
  deliverySlot,
  editSlot,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onQuote?: () => void;
  canQuote?: boolean;
  toLine: string | null;
  ccLine: string | null;
  showDetails: boolean;
  onToggleDetails: () => void;
  deliverySlot?: ReactNode;
  editSlot?: ReactNode;
}) => {
  const hasRecipients = Boolean(toLine || ccLine);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 group-hover/message:opacity-100 data-[state=open]:opacity-100"
          aria-label="Message actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onToggle();
          }}
        >
          <ChevronDown className="size-3.5" />
          {collapsed ? "Expand message" : "Collapse message"}
        </DropdownMenuItem>
        {canQuote && onQuote ? (
          <DropdownMenuItem onSelect={onQuote}>
            <Reply className="size-3.5" />
            Quote reply
          </DropdownMenuItem>
        ) : null}
        {editSlot}
        {hasRecipients || deliverySlot ? <DropdownMenuSeparator /> : null}
        {hasRecipients ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onToggleDetails();
            }}
          >
            {showDetails ? "Hide details" : "Show details"}
          </DropdownMenuItem>
        ) : null}
        {hasRecipients && showDetails ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="space-y-1 font-normal text-muted-foreground">
              {toLine ? (
                <p className="truncate text-xs">
                  <span className="font-medium text-foreground/80">To:</span>{" "}
                  {toLine}
                </p>
              ) : null}
              {ccLine ? (
                <p className="truncate text-xs">
                  <span className="font-medium text-foreground/80">Cc:</span>{" "}
                  {ccLine}
                </p>
              ) : null}
            </DropdownMenuLabel>
          </>
        ) : null}
        {deliverySlot ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal">
              {deliverySlot}
            </DropdownMenuLabel>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TicketThreadMessage = ({
  message,
  collapsed,
  onToggle,
  isLatest,
  isFirst,
  isLast,
}: {
  message: TicketMessage;
  collapsed: boolean;
  onToggle: () => void;
  isLatest: boolean;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const readCutoff = useTicketReadCutoff();
  const quoteContext = useTicketThreadQuote();
  const canEditInternal = useMemberCapability("support.tickets.manage");
  const [isEditingInternal, setIsEditingInternal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const inbound = message.direction === "inbound";
  const isInternal = message.direction === "internal";
  const outbound = message.direction === "outbound";
  const senderEmail = message.from_email?.trim();
  const senderName = message.from_name?.trim();
  const displayName =
    senderName || senderEmail || (inbound ? "Customer" : "Team");

  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as FileAttachment[])
    : [];
  const preview = useMemo(() => getMessagePreview(message), [message]);
  const toLine = formatRecipientList(message.to_emails);
  const ccLine = formatRecipientList(message.cc_emails);
  const attachmentCount = attachments.length;
  const unreadInbound =
    inbound && isInboundMessageUnread(message, readCutoff);

  const handleQuote = () => {
    quoteContext?.quoteMessage(message);
  };

  useEffect(() => {
    setIsEditingInternal(false);
    setShowDetails(false);
  }, [message.id]);

  const treeTone: ThreadTreeTone = isInternal
    ? "internal"
    : unreadInbound
      ? "unread"
      : inbound
        ? "inbound"
        : outbound
          ? "outbound"
          : "default";

  if (isInternal) {
    const author = senderName || "Team";
    const compactAuditBody = compactMergeAuditNote(message.body);

    return (
      <article className="group/message flex w-full text-sm">
        <ThreadTreeGuide isFirst={isFirst} isLast={isLast} tone={treeTone} />
        <div
          className={cn(
            "min-w-0 flex-1 rounded-r-md bg-amber-50/50 py-3 pr-1 pl-2 dark:bg-amber-950/20",
            isEditingInternal && "bg-amber-50/80 dark:bg-amber-950/30",
          )}
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => !isEditingInternal && onToggle()}
              disabled={isEditingInternal}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200">
                    <Lock className="size-3 shrink-0" />
                    Internal note
                  </span>
                  <span className="font-medium text-foreground">{author}</span>
                  {attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Paperclip className="size-3" />
                      {attachmentCount}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTicketMessageTime(message.created_at)}
                </span>
              </div>
              {collapsed && !isEditingInternal ? (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {preview === "No message content" && attachmentCount > 0
                    ? `${attachmentCount} attached file${attachmentCount === 1 ? "" : "s"}`
                    : preview}
                </p>
              ) : null}
            </button>
            {!isEditingInternal ? (
              <MessageOverflowMenu
                collapsed={collapsed}
                onToggle={onToggle}
                toLine={toLine}
                ccLine={ccLine}
                showDetails={showDetails}
                onToggleDetails={() => setShowDetails((current) => !current)}
                editSlot={
                  canEditInternal ? (
                    <DropdownMenuItem
                      onSelect={() => setIsEditingInternal(true)}
                    >
                      Edit note
                    </DropdownMenuItem>
                  ) : null
                }
              />
            ) : null}
          </div>
          {isEditingInternal ? (
            <TicketInternalNoteEditor
              message={message}
              onDone={() => setIsEditingInternal(false)}
            />
          ) : !collapsed ? (
            <>
              {showDetails && (toLine || ccLine) ? (
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {toLine ? (
                    <p>
                      <span className="font-medium text-foreground/80">
                        To:
                      </span>{" "}
                      {toLine}
                    </p>
                  ) : null}
                  {ccLine ? (
                    <p>
                      <span className="font-medium text-foreground/80">
                        Cc:
                      </span>{" "}
                      {ccLine}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <TicketMessageContent
                body={compactAuditBody ?? message.body}
                htmlBody={compactAuditBody ? null : message.html_body}
                attachments={attachments}
                className="mt-3 text-foreground [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_section]:border-amber-500/30"
              />
            </>
          ) : null}
        </div>
      </article>
    );
  }

  const canQuote = Boolean(inbound && quoteContext);

  return (
    <article
      className={cn(
        "group/message flex w-full text-sm transition-colors",
        unreadInbound && "bg-blue-50/30 dark:bg-blue-950/10",
      )}
    >
      <ThreadTreeGuide isFirst={isFirst} isLast={isLast} tone={treeTone} />
      <div className="min-w-0 flex-1 py-3 pr-1 pl-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={onToggle}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate font-semibold text-foreground">
                  {displayName}
                </span>
                {senderName && senderEmail ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {senderEmail}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {inbound ? "Received" : "Sent"}
                </span>
                {attachmentCount > 0 && collapsed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Paperclip className="size-3" />
                    {attachmentCount}
                  </span>
                ) : null}
                {outbound && !collapsed ? (
                  <EmailDeliveryBadge message={message} compact />
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTicketMessageTime(message.created_at)}
              </span>
            </div>
            {collapsed ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {preview}
              </p>
            ) : null}
          </button>
          <MessageOverflowMenu
            collapsed={collapsed}
            onToggle={onToggle}
            onQuote={handleQuote}
            canQuote={canQuote}
            toLine={toLine}
            ccLine={ccLine}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((current) => !current)}
            deliverySlot={
              outbound ? <EmailDeliveryBadge message={message} /> : null
            }
          />
        </div>

        {!collapsed ? (
          <>
            {showDetails && (toLine || ccLine) ? (
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
              className="mt-3 text-foreground"
              emailVariant={inbound ? "inbound" : "outbound"}
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

const VISIBLE_TAIL_COUNT = 4;

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
  const [showAllEarlier, setShowAllEarlier] = useState(false);

  const messageIds = useMemo(
    () => messages.map((message) => Number(message.id)).filter(Number.isFinite),
    [messages],
  );

  const messageIdsKey = messageIds.join(",");

  useEffect(() => {
    // Newest-first: expand the top message, collapse older ones.
    if (messageIds.length <= 1) {
      setCollapsedIds(new Set());
      return;
    }
    setCollapsedIds(new Set(messageIds.slice(1)));
  }, [messageIdsKey]);

  useEffect(() => {
    setShowAllEarlier(false);
  }, [messageIdsKey]);

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

  // Messages arrive newest-first; keep the latest visible at the top.
  const latestId = messageIds[0];
  const hiddenCount =
    !showAllEarlier && messages.length > VISIBLE_TAIL_COUNT
      ? messages.length - VISIBLE_TAIL_COUNT
      : 0;
  const visibleMessages =
    hiddenCount > 0 ? messages.slice(0, VISIBLE_TAIL_COUNT) : messages;

  return (
    <div>
      <div ref={threadEndRef} className="h-px shrink-0" aria-hidden />
      <div className="flex flex-col">
        {visibleMessages.map((message, index) => {
          const messageId = Number(message.id);
          return (
            <TicketThreadMessage
              key={message.id}
              message={message}
              collapsed={collapsedIds.has(messageId)}
              onToggle={() => toggleMessage(messageId)}
              isLatest={messageId === latestId}
              isFirst={index === 0}
              isLast={index === visibleMessages.length - 1}
            />
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div className="flex justify-center border-t border-border/60 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowAllEarlier(true)}
          >
            Show {hiddenCount} earlier message
            {hiddenCount === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
