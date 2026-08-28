import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  ChevronDown,
  FolderInput,
  Lock,
  MoreHorizontal,
  Paperclip,
  Reply,
} from "lucide-react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { Ticket, TicketMessage } from "@/modules/types";
import { EmailDeliveryBadge } from "@/modules/tickets/EmailDeliveryBadge";
import { TicketInternalNoteEditor } from "@/modules/tickets/TicketInternalNoteEditor";
import { TicketInvoiceSentNoteCard } from "@/modules/tickets/TicketInvoiceSentNoteCard";
import { TicketStatusChangeNoteCard } from "@/modules/tickets/TicketStatusChangeNoteCard";
import {
  InternalNotePlainBody,
  stripInternalNoteMarkdown,
} from "@/modules/tickets/InternalNotePlainBody";
import { TicketMessageAvatar } from "@/modules/tickets/TicketMessageAvatar";
import { TicketMessageContent } from "@/modules/tickets/TicketMessageContent";
import { TicketMoveMessagesDialog } from "@/modules/tickets/TicketMoveMessagesDialog";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type { Company } from "@/components/atomic-crm/types";
import {
  isInvoiceSentInternalNote,
  previewInvoiceSentInternalNote,
} from "@/modules/tickets/parseInvoiceSentInternalNote";
import {
  isStatusChangeInternalNote,
  previewStatusChangeInternalNote,
} from "@/modules/tickets/parseStatusChangeInternalNote";
import { useTicketReadCutoff } from "@/modules/tickets/TicketReadCutoffContext";
import { useTicketThreadQuote } from "@/modules/tickets/TicketThreadQuoteContext";
import { isInboundMessageUnread } from "@/modules/tickets/ticketReadState";
import { formatTicketMessageTime, getReplyDurationLabel } from "@/modules/tickets/ticketInboxUi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { htmlToPlainText } from "@/modules/tickets/ticketReplyRichText";
import { useNavigate } from "react-router";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import type { Identifier } from "ra-core";

const PREVIEW_MAX_LENGTH = 140;

/** Compact legacy"Merged tickets: #1 (long subject), …" audit notes. */
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
  return `Merged ${ids.length} tickets into this thread (${ids.join(",")}).`;
};

const getMessageBodyText = (message: TicketMessage) => {
  const invoicePreview = previewInvoiceSentInternalNote(message.body);
  if (invoicePreview) return invoicePreview;
  const statusPreview = previewStatusChangeInternalNote(message.body);
  if (statusPreview) return statusPreview;
  const compact = compactMergeAuditNote(message.body);
  if (compact) return compact;
  return message.body?.trim() || message.html_body || "";
};

const getMessagePreview = (message: TicketMessage) => {
  const source = getMessageBodyText(message);
  const text = stripInternalNoteMarkdown(
    htmlToPlainText(source).replace(/\s+/g, " ").trim(),
  );
  if (!text) return "No message content";
  if (text.length <= PREVIEW_MAX_LENGTH) return text;
  return `${text.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
};

const formatRecipientList = (emails?: string[] | null) => {
  const list = (emails ?? []).map((email) => email.trim()).filter(Boolean);
  if (!list.length) return null;
  return list.join(", ");
};

const MessageOverflowMenu = ({
  collapsed,
  onToggle,
  toLine,
  ccLine,
  showDetails,
  onToggleDetails,
  deliverySlot,
  editSlot,
}: {
  collapsed: boolean;
  onToggle: () => void;
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
        <IconButton
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 data-[state=open]:opacity-100"
          aria-label="Message actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </IconButton>
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
  allMessages,
  collapsed,
  onToggle,
  company,
  orgWebsite,
  selectable = false,
  selected = false,
  onSelectedChange,
}: {
  message: TicketMessage;
  allMessages: TicketMessage[];
  collapsed: boolean;
  onToggle: () => void;
  company?: Company | null;
  orgWebsite?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
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
  const replyDurationLabel = outbound
    ? getReplyDurationLabel(message, allMessages)
    : null;
  const attachmentCount = attachments.length;
  const unreadInbound = inbound && isInboundMessageUnread(message, readCutoff);

  const handleQuote = () => {
    quoteContext?.quoteMessage(message);
  };

  useEffect(() => {
    setIsEditingInternal(false);
    setShowDetails(false);
  }, [message.id]);

  const avatarWithSelect = (
    display: string,
    direction: "inbound" | "outbound" | "internal",
    alignEnd = false,
  ) => (
    <div className="group/avatar relative mt-0.5 shrink-0">
      {selectable && direction !== "internal" ? (
        <div
          className={cn(
            "absolute -top-0.5 z-10 transition-opacity",
            alignEnd ? "-right-0.5" : "-left-0.5",
            selected
              ? "opacity-100"
              : "opacity-0 group-hover/avatar:opacity-100 focus-within:opacity-100",
          )}
        >
          <Checkbox
            checked={selected}
            className="size-4 border-background bg-background shadow-sm"
            aria-label="Select message"
            onCheckedChange={(value) => onSelectedChange?.(value === true)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
      <TicketMessageAvatar
        direction={direction}
        displayName={display}
        email={senderEmail}
        company={company}
        orgWebsite={orgWebsite}
        className={cn(
          selectable &&
            direction !== "internal" &&
            !selected &&
            "transition-opacity group-hover/avatar:opacity-40",
        )}
      />
    </div>
  );

  if (isInternal) {
    const author = senderName || "Team";
    const compactAuditBody = compactMergeAuditNote(message.body);
    const invoiceSentNote = isInvoiceSentInternalNote(message.body);
    const statusChangeNote = isStatusChangeInternalNote(message.body);
    const plainInternalBody = compactAuditBody ?? message.body;
    const usePlainMarkdownBody =
      !invoiceSentNote &&
      !statusChangeNote &&
      Boolean(plainInternalBody?.trim()) &&
      !message.html_body?.trim();

    return (
      <article className="group/message flex w-full justify-center text-sm">
        <div className="flex w-full max-w-[min(100%,42rem)] gap-2.5">
          {avatarWithSelect(author, "internal")}
          <div
            className={cn(
              "min-w-0 flex-1 rounded-2xl border border-amber-200/70 py-3 pr-1 pl-3 shadow-sm dark:border-amber-900/50",
              isEditingInternal && "bg-amber-50/80 dark:bg-amber-950/30",
              !isEditingInternal && "bg-amber-50/50 dark:bg-amber-950/25",
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
              {invoiceSentNote ? (
                <TicketInvoiceSentNoteCard body={message.body} />
              ) : statusChangeNote ? (
                <TicketStatusChangeNoteCard body={message.body} />
              ) : usePlainMarkdownBody ? (
                <div className="mt-3">
                  <InternalNotePlainBody text={plainInternalBody ?? ""} />
                </div>
              ) : (
                <TicketMessageContent
                  body={compactAuditBody ?? message.body}
                  htmlBody={compactAuditBody ? null : message.html_body}
                  attachments={attachments}
                  className="mt-3 text-foreground [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_section]:border-amber-500/30"
                />
              )}
            </>
          ) : null}
          </div>
        </div>
      </article>
    );
  }

  const canQuote = Boolean(inbound && quoteContext);

  return (
    <article
      className={cn(
        "group/message flex w-full gap-2.5 text-sm",
        outbound ? "flex-row-reverse justify-start" : "justify-start",
      )}
    >
      {avatarWithSelect(displayName, inbound ? "inbound" : "outbound", outbound)}
      <div
        className={cn(
          "min-w-0 w-full max-w-[min(100%,min(42rem,90%))] rounded-2xl border py-3 pr-1 pl-3 shadow-sm",
          unreadInbound && "ring-1 ring-blue-400/40",
          selected && "ring-1 ring-primary/40",
          inbound
            ? "border-slate-200 bg-card dark:border-slate-700"
            : "border-blue-200/80 bg-blue-50/45 dark:border-blue-900/50 dark:bg-blue-950/25",
        )}
      >
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
                {inbound ? (
                  <span className="text-[11px] text-muted-foreground">
                    Received
                  </span>
                ) : null}
                {outbound && toLine ? (
                  <span
                    className="max-w-[12rem] truncate text-[11px] text-muted-foreground"
                    title={`To: ${toLine}`}
                  >
                    To: {toLine}
                  </span>
                ) : null}
                {outbound ? (
                  <EmailDeliveryBadge
                    message={message}
                    compact
                    replyDurationLabel={replyDurationLabel}
                  />
                ) : null}
                {outbound && replyDurationLabel ? (
                  <span className="text-[11px] text-muted-foreground">
                    {replyDurationLabel}
                  </span>
                ) : null}
                {attachmentCount > 0 && collapsed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Paperclip className="size-3" />
                    {attachmentCount}
                  </span>
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
          <div className="flex shrink-0 items-center gap-0.5 self-start">
            {canQuote ? (
              <IconButton
                className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/message:opacity-100"
                aria-label="Reply to this message"
                title="Reply to this message"
                onClick={(event) => {
                  event.stopPropagation();
                  handleQuote();
                }}
              >
                <Reply className="size-4" />
              </IconButton>
            ) : null}
            <MessageOverflowMenu
              collapsed={collapsed}
              onToggle={onToggle}
              toLine={toLine}
              ccLine={ccLine}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails((current) => !current)}
              deliverySlot={
                outbound ? (
                  <EmailDeliveryBadge
                    message={message}
                    replyDurationLabel={replyDurationLabel}
                  />
                ) : null
              }
            />
          </div>
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
  company,
  readBaseline,
  ticket,
}: {
  messages: TicketMessage[];
  isPending?: boolean;
  threadEndRef?: RefObject<HTMLDivElement | null>;
  company?: Company | null;
  /**
   * last_read_at when the ticket was opened (before mark-as-read).
   * undefined = still loading. null = never read.
   * Newest message stays expanded only if newer than this baseline.
   */
  readBaseline?: string | null;
  ticket?: Ticket | null;
}) => {
  const navigate = useNavigate();
  const orgWebsite = getInvoiceOrganizationBranding().website;
  const canMove = useMemberCapability("support.tickets.manage");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [moveMode, setMoveMode] = useState<"new" | "existing" | null>(null);

  const messageIds = useMemo(
    () => messages.map((message) => Number(message.id)).filter(Number.isFinite),
    [messages],
  );

  const movableIds = useMemo(
    () =>
      messages
        .filter((message) => message.direction !== "internal")
        .map((message) => Number(message.id))
        .filter(Number.isFinite),
    [messages],
  );

  const messageIdsKey = messageIds.join(",");
  const prevMessageIdsRef = useRef<number[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    setSelectedIds(new Set());
    setMoveMode(null);
  }, [ticket?.id]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set<number>();
      for (const id of current) {
        if (movableIds.includes(id)) next.add(id);
      }
      return next.size === current.size ? current : next;
    });
  }, [movableIds]);

  useEffect(() => {
    if (messageIds.length === 0) {
      setCollapsedIds(new Set());
      prevMessageIdsRef.current = [];
      initializedRef.current = false;
      return;
    }

    // Wait until we know whether this open is a first look or a revisit.
    if (readBaseline === undefined) return;

    const prevIds = prevMessageIdsRef.current;
    const prevSet = new Set(prevIds);
    const latestId = messageIds[messageIds.length - 1];

    if (!initializedRef.current) {
      initializedRef.current = true;
      // Expand the newest inbound only when it arrived after the last open.
      const latestInbound = [...messages]
        .reverse()
        .find((message) => message.direction === "inbound");
      const inboundId = latestInbound ? Number(latestInbound.id) : NaN;
      const inboundUnread =
        Number.isFinite(inboundId) &&
        (readBaseline == null ||
          (Boolean(latestInbound?.created_at) &&
            latestInbound!.created_at > readBaseline));
      setCollapsedIds(
        inboundUnread
          ? new Set(messageIds.filter((id) => id !== inboundId))
          : new Set(messageIds),
      );
      prevMessageIdsRef.current = messageIds;
      return;
    }

    if (messageIdsKey !== prevIds.join(",")) {
      setCollapsedIds((current) => {
        const next = new Set(current);
        for (const id of messageIds) {
          if (id === latestId) {
            next.delete(id);
          } else if (!prevSet.has(id)) {
            next.add(id);
          }
        }
        for (const id of next) {
          if (!messageIds.includes(id)) {
            next.delete(id);
          }
        }
        // When a new latest arrives while viewing, expand it.
        if (latestId != null && !prevSet.has(latestId)) {
          for (const id of messageIds) {
            if (id !== latestId) next.add(id);
          }
          next.delete(latestId);
        }
        return next;
      });
    }

    prevMessageIdsRef.current = messageIds;
  }, [messageIdsKey, messageIds, messages, readBaseline]);

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

  const toggleSelected = (messageId: number, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  };

  // Messages arrive oldest-first; show newest at the top (email-style).
  const latestId = messageIds[messageIds.length - 1];
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);
  const selectedList = useMemo(
    () => [...selectedIds] as Identifier[],
    [selectedIds],
  );
  const showMoveUi = Boolean(canMove && ticket);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showMoveUi && selectedIds.size > 0 ? (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <FolderInput className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMoveMode("new")}
            >
              Move to new ticket
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMoveMode("existing")}
            >
              Move to existing
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div ref={threadEndRef} className="h-px shrink-0" aria-hidden />
      <div className="flex flex-col gap-4 px-0.5">
        {newestFirst.map((message) => {
          const messageId = Number(message.id);
          return (
            <TicketThreadMessage
              key={message.id}
              message={message}
              allMessages={messages}
              collapsed={collapsedIds.has(messageId)}
              onToggle={() => toggleMessage(messageId)}
              company={company}
              orgWebsite={orgWebsite}
              selectable={showMoveUi}
              selected={selectedIds.has(messageId)}
              onSelectedChange={(selected) =>
                toggleSelected(messageId, selected)
              }
            />
          );
        })}
      </div>

      {ticket && moveMode ? (
        <TicketMoveMessagesDialog
          open
          onOpenChange={(open) => {
            if (!open) setMoveMode(null);
          }}
          mode={moveMode}
          sourceTicket={ticket}
          messageIds={selectedList}
          onMoved={(targetTicketId, createdNew) => {
            setSelectedIds(new Set());
            setMoveMode(null);
            if (createdNew || String(targetTicketId) !== String(ticket.id)) {
              navigate(ticketShowPath(targetTicketId));
            }
          }}
        />
      ) : null}
    </div>
  );
};
