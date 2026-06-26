import { useCallback, useEffect, useRef, useState } from "react";
import { useGetList, useGetOne, useRefresh, useUpdate } from "ra-core";
import { useNavigate } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Deal, Ticket, TicketMessage } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useIsMobile } from "@/hooks/use-mobile";
import { TicketCompactHeader } from "@/modules/tickets/TicketCompactHeader";
import {
  TicketContextPanel,
  TicketContextSheet,
} from "@/modules/tickets/TicketContextPanel";
import { TicketReplyForm } from "@/modules/tickets/TicketReplyForm";
import { TicketThread } from "@/modules/tickets/TicketThread";
import { TicketReadCutoffContext } from "@/modules/tickets/TicketReadCutoffContext";
import { TicketThreadQuoteProvider } from "@/modules/tickets/TicketThreadQuoteContext";
import { useAutoLinkTicketRequester } from "@/modules/tickets/useAutoLinkTicketRequester";
import { useTicketMemberRead } from "@/modules/tickets/useTicketInboxReads";
import { useTicketThreadMessages } from "@/modules/tickets/useTicketThreadMessages";

export const TicketDetailPanel = ({ ticketId }: { ticketId: string }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const refresh = useRefresh();
  const canManage = useMemberCapability("support.tickets.manage");
  const {
    lastReadAt,
    isLoading: isReadLoading,
    markRead,
  } = useTicketMemberRead(ticketId);
  const [readCutoff, setReadCutoff] = useState<string | null | undefined>(
    undefined,
  );
  const [quoteMessage, setQuoteMessage] = useState<TicketMessage | null>(null);
  const markedTicketRef = useRef<string | null>(null);
  const openedStatusRef = useRef<string | null>(null);
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
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: ticket?.contact_id ?? "" },
    { enabled: Boolean(ticket?.contact_id) },
  );
  const { data: mergedChildren = [] } = useGetList<Ticket>(
    "tickets",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
      filter: ticket?.id
        ? { "merged_into_ticket_id@eq": ticket.id }
        : { "id@eq": -1 },
    },
    { enabled: Boolean(ticket?.id) },
  );
  const {
    messages,
    isPending: messagesPending,
    threadEndRef,
    scrollToBottom,
  } = useTicketThreadMessages(ticket?.id);

  const handleQuote = useCallback((message: TicketMessage) => {
    setQuoteMessage(message);
  }, []);

  useEffect(() => {
    if (isReadLoading) return;
    setReadCutoff(lastReadAt ?? "1970-01-01T00:00:00.000Z");
    if (markedTicketRef.current === ticketId) return;
    markedTicketRef.current = ticketId;
    void markRead();
  }, [ticketId, lastReadAt, isReadLoading, markRead]);

  useEffect(() => {
    if (!ticket || ticket.status !== "new") return;
    if (openedStatusRef.current === String(ticket.id)) return;
    openedStatusRef.current = String(ticket.id);
    update(
      "tickets",
      { id: ticket.id, data: { status: "open" }, previousData: ticket },
      { mutationMode: "pessimistic" },
    );
  }, [ticket, update]);

  if (isPending || !ticket) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading ticket…
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
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() =>
            navigate(`/tickets/${ticket.merged_into_ticket_id}/show`)
          }
        >
          Open primary ticket
        </button>
      </div>
    );
  }

  return (
    <TicketThreadQuoteProvider onQuote={handleQuote}>
      <div className="flex h-full min-h-0 overflow-hidden bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TicketCompactHeader
            ticket={ticket}
            company={company}
            contact={contact}
            deal={deal}
            canManage={canManage}
            onUpdated={refresh}
            showBack={isMobile}
            onBack={() => navigate("/tickets")}
            contextAction={
              isMobile ? (
                <TicketContextSheet
                  ticket={ticket}
                  company={company}
                  contact={contact}
                />
              ) : null
            }
          />

          {mergedChildren.length > 0 ? (
            <p className="shrink-0 border-b border-info/30 bg-info/10 px-4 py-2 text-xs text-info md:px-5">
              Includes merged tickets:{" "}
              {mergedChildren
                .map((child) => `#${child.id} (${child.subject})`)
                .join(", ")}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
            <TicketReadCutoffContext.Provider value={readCutoff}>
              <TicketThread
                messages={messages}
                isPending={messagesPending}
                threadEndRef={threadEndRef}
              />
            </TicketReadCutoffContext.Provider>
          </div>

          <div className="shrink-0 bg-background">
            <TicketReplyForm
              key={`reply-${ticket.id}`}
              ticket={ticket}
              placement="bottom"
              quoteMessage={quoteMessage}
              onQuoteApplied={() => setQuoteMessage(null)}
              onSent={() => scrollToBottom()}
            />
          </div>
        </div>

        {!isMobile ? (
          <TicketContextPanel
            ticket={ticket}
            company={company}
            contact={contact}
          />
        ) : null}
      </div>
    </TicketThreadQuoteProvider>
  );
};
