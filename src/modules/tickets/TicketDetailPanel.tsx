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
  layout = "default",
  previewMode = false,
  onContextExpandedChange,
}: {
  ticketId: string;
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
  const overlayContext = layout === "inbox-split";
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
    scrollToBottom,
  } = useTicketThreadMessages(ticket?.id);

  const handleQuote = useCallback((message: TicketMessage) => {
    setQuoteMessage(message);
  }, []);

  useEffect(() => {
    if (isReadLoading) return;
    setReadCutoff(lastReadAt ?? "1970-01-01T00:00:00.000Z");
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
          "relative flex h-full min-h-0 overflow-hidden bg-background",
          previewMode && !overlayContext && "flex-nowrap",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            previewMode && !overlayContext
              ? TICKET_PREVIEW_THREAD_CLASS
              : "min-w-0 flex-1",
            !overlayContext &&
              !previewMode &&
              "transition-[flex-grow,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 py-2 md:px-5">
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
              ref={replyFormRef}
              ticket={ticket}
              placement="bottom"
              quoteMessage={quoteMessage}
              onQuoteApplied={() => setQuoteMessage(null)}
              onSent={() => scrollToBottom()}
            />
          </div>
        </div>

        {!useContextSheet ? (
          <TicketContextPanel
            ticket={ticket}
            company={company}
            contact={contact}
            overlay={overlayContext}
            animateResize={!overlayContext}
            onExpandedChange={
              previewMode && !overlayContext
                ? onContextExpandedChange
                : undefined
            }
          />
        ) : null}
      </div>
    </TicketThreadQuoteProvider>
  );
};
