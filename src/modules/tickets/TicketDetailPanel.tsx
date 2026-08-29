import { useCallback, useEffect, useRef, useState } from "react";
import { useGetOne, useUpdate } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Deal, Ticket, TicketMessage } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { TicketCompactHeader } from "@/modules/tickets/TicketCompactHeader";
import {
  TicketContextPanel,
  TicketContextSheet,
} from "@/modules/tickets/TicketContextPanel";
import { TICKET_PREVIEW_THREAD_CLASS } from "@/modules/tickets/ticketContextLayout";
import { TicketComposeActionBar } from "@/modules/tickets/TicketComposeActionBar";
import {
  TicketReplyForm,
  type TicketReplyFormHandle,
} from "@/modules/tickets/TicketReplyForm";
import { TicketRetryDeliveryBanner } from "@/modules/tickets/TicketRetryDeliveryBanner";
import { TicketThread } from "@/modules/tickets/TicketThread";
import { TicketReadCutoffContext } from "@/modules/tickets/TicketReadCutoffContext";
import { TicketThreadQuoteProvider } from "@/modules/tickets/TicketThreadQuoteContext";
import { useAutoLinkTicketRequester } from "@/modules/tickets/useAutoLinkTicketRequester";
import { useTicketMemberRead } from "@/modules/tickets/useTicketInboxReads";
import { useTicketThreadMessages } from "@/modules/tickets/useTicketThreadMessages";
import { isTicketStatusFilterId } from "@/modules/tickets/ticketStatusWorkflow";
import { refreshTicketInboxLists } from "@/modules/tickets/ticketsRealtimeCache";
import { Button } from "@/components/ui/button";

export const TicketDetailPanel = ({
  ticketId,
  layout: _layout = "default",
  previewMode = false,
  onContextExpandedChange,
}: {
  ticketId: string;
  /** @deprecated Overlay mode removed; context always pushes the thread. */
  layout?: "default" | "inbox-split";
  /** Keeps thread width fixed; preview sheet grows when context opens. */
  previewMode?: boolean;
  onContextExpandedChange?: (expanded: boolean) => void;
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  // Desktop (including inbox split): collapsible icon rail.
  // Mobile: sheet trigger in the header.
  const useContextSheet = isMobile;
  const queryClient = useQueryClient();
  const refreshInbox = useCallback(() => {
    refreshTicketInboxLists(queryClient);
  }, [queryClient]);
  const canManage = useMemberCapability("support.tickets.manage");
  const canSendInvoices = useMemberCapability("proposals.send");
  const canReplyAndCharge = canManage && canSendInvoices;
  const {
    lastReadAt,
    isLoading: isReadLoading,
    markRead,
  } = useTicketMemberRead(ticketId);
  const [readCutoff, setReadCutoff] = useState<string | null | undefined>(
    undefined,
  );
  /** Snapshot of last_read_at before markRead — drives expand-vs-collapse on open. */
  const [threadReadBaseline, setThreadReadBaseline] = useState<
    string | null | undefined
  >(undefined);
  const [quoteMessage, setQuoteMessage] = useState<TicketMessage | null>(null);
  const markedTicketRef = useRef<string | null>(null);
  const openedStatusRef = useRef<string | null>(null);
  const replyFormRef = useRef<TicketReplyFormHandle>(null);
  const [update] = useUpdate();

  const { data: ticket, isPending } = useGetOne<Ticket>("tickets", {
    id: ticketId,
  });
  useAutoLinkTicketRequester(ticket);
  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: ticket?.deal_id ?? "" },
    { enabled: Boolean(ticket?.deal_id) },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: ticket?.company_id ?? "" },
    { enabled: Boolean(ticket?.company_id) },
  );
  const resolvedContactId =
    ticket?.contact_id ?? company?.primary_contact_id ?? null;
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: resolvedContactId ?? "" },
    { enabled: Boolean(resolvedContactId) },
  );
  const {
    messages,
    isPending: messagesPending,
    threadEndRef,
    scrollToLatest,
  } = useTicketThreadMessages(ticket?.id);

  const handleQuote = useCallback((message: TicketMessage) => {
    setQuoteMessage(message);
  }, []);

  useEffect(() => {
    setThreadReadBaseline(undefined);
  }, [ticketId]);

  useEffect(() => {
    if (isReadLoading) return;
    setReadCutoff(lastReadAt ?? "1970-01-01T00:00:00.000Z");
    setThreadReadBaseline((current) =>
      current === undefined ? (lastReadAt ?? null) : current,
    );
  }, [ticketId, lastReadAt, isReadLoading]);

  useEffect(() => {
    if (isReadLoading) return;
    if (markedTicketRef.current === ticketId) return;
    markedTicketRef.current = ticketId;
    void markRead().then((now) => {
      if (now) setReadCutoff(now);
    });
  }, [ticketId, isReadLoading, markRead]);

  useEffect(() => {
    if (!ticket || ticket.status !== "new") return;
    if (openedStatusRef.current === String(ticket.id)) return;
    openedStatusRef.current = String(ticket.id);
    update(
      "tickets",
      { id: ticket.id, data: { status: "open" }, previousData: ticket },
      {
        mutationMode: "pessimistic",
        onSuccess: () => {
          refreshInbox();
        },
      },
    );
  }, [ticket, update, refreshInbox]);

  if (!ticket && isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Ticket not found.
      </div>
    );
  }

  if (ticket.merged_into_ticket_id) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Ticket #{ticket.id} was merged into ticket #
          {ticket.merged_into_ticket_id}.
        </p>
        {ticket.merge_note ? (
          <p className="max-w-md text-xs text-muted-foreground">
            {ticket.merge_note}
          </p>
        ) : null}
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-sm font-medium"
          onClick={() =>
            navigate(`/tickets/${ticket.merged_into_ticket_id}/show`)
          }
        >
          Open primary ticket
        </Button>
      </div>
    );
  }

  return (
    <TicketThreadQuoteProvider onQuote={handleQuote}>
      <div
        className={cn(
          "relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-background",
          // Grid keeps the thread on minmax(0,1fr) and the context rail/panel
          // on an auto track — more reliable than flex-1 + width transitions.
          previewMode ? "flex flex-nowrap" : "grid grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden",
            previewMode ? TICKET_PREVIEW_THREAD_CLASS : "w-full",
          )}
        >
          <TicketCompactHeader
            ticket={ticket}
            company={company}
            contact={contact}
            deal={deal}
            canManage={canManage}
            onUpdated={refreshInbox}
            showBack={isMobile}
            onBack={() => {
              const status = searchParams.get("status");
              navigate(
                status && isTicketStatusFilterId(status) && status !== "all"
                  ? `/tickets?status=${status}`
                  : "/tickets",
                { viewTransition: true },
              );
            }}
            composeActions={
              <TicketComposeActionBar
                canReplyAndCharge={canReplyAndCharge}
                onOpen={(mode, options) =>
                  replyFormRef.current?.openComposer(mode, options)
                }
              />
            }
            contextAction={
              useContextSheet ? (
                <TicketContextSheet
                  ticket={ticket}
                  company={company}
                  contact={contact}
                />
              ) : null
            }
          />

          <TicketRetryDeliveryBanner ticket={ticket} />

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-3 md:px-5">
              <TicketReadCutoffContext.Provider value={readCutoff}>
                <TicketThread
                  key={ticket.id}
                  messages={messages}
                  isPending={messagesPending}
                  threadEndRef={threadEndRef}
                  company={company}
                  readBaseline={threadReadBaseline}
                  ticket={ticket}
                />
              </TicketReadCutoffContext.Provider>
            </div>

            {/* Gmail-style compose dock — only visible while composing */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-end p-3 sm:p-4">
              <div className="pointer-events-auto">
                <TicketReplyForm
                  key={`reply-${ticket.id}`}
                  ref={replyFormRef}
                  ticket={ticket}
                  placement="dock"
                  quoteMessage={quoteMessage}
                  onQuoteApplied={() => setQuoteMessage(null)}
                  onSent={() => scrollToLatest()}
                />
              </div>
            </div>
          </div>
        </div>

        {!useContextSheet ? (
          <TicketContextPanel
            ticket={ticket}
            company={company}
            contact={contact}
            overlay={false}
            animateResize
            onExpandedChange={
              previewMode ? onContextExpandedChange : undefined
            }
          />
        ) : null}
      </div>
    </TicketThreadQuoteProvider>
  );
};
