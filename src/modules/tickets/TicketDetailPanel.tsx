import { Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetList, useGetOne } from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import type { Deal, Ticket, TicketMessage } from "@/modules/types";
import { TicketReplyForm } from "@/modules/tickets/TicketReplyForm";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import { TicketThread } from "@/modules/tickets/TicketThread";
import { TicketReadCutoffContext } from "@/modules/tickets/TicketReadCutoffContext";
import { useTicketMemberRead } from "@/modules/tickets/useTicketInboxReads";
import { getTicketClaimLabel } from "@/modules/tickets/ticketInboxUi";
import { getClientShowPath } from "@/app/routing";

export const TicketDetailPanel = ({ ticketId }: { ticketId: string }) => {
  const { lastReadAt, isLoading: isReadLoading, markRead } =
    useTicketMemberRead(ticketId);
  const [readCutoff, setReadCutoff] = useState<string | null | undefined>(
    undefined,
  );
  const markedTicketRef = useRef<string | null>(null);

  const { data: ticket, isPending } = useGetOne<Ticket>("tickets", {
    id: ticketId,
  });
  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: ticket?.deal_id ?? "" },
    { enabled: Boolean(ticket?.deal_id) },
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

  useEffect(() => {
    if (isReadLoading) return;
    setReadCutoff(lastReadAt ?? "1970-01-01T00:00:00.000Z");
    if (markedTicketRef.current === ticketId) return;
    markedTicketRef.current = ticketId;
    void markRead();
  }, [ticketId, lastReadAt, isReadLoading, markRead]);

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
          Ticket #{ticket.id} was merged into ticket #{ticket.merged_into_ticket_id}.
        </p>
        {ticket.merge_note ? (
          <p className="max-w-md text-xs text-muted-foreground">{ticket.merge_note}</p>
        ) : null}
        <Link
          to={`/tickets/${ticket.merged_into_ticket_id}/show`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open primary ticket
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#fcfcfb]">
      <div className="shrink-0 border-b bg-background px-5 py-4">
        <div className="space-y-2">
          <div className="min-w-0 space-y-2">
            <TicketSubjectField
              key={`subject-${ticket.id}`}
              ticket={ticket}
              className="text-2xl font-semibold"
              inputClassName="text-2xl font-semibold"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {ticket.company_id ? (
                <>
                  <Building2 className="size-4 shrink-0" />
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    record={ticket}
                    link={(companyId) => getClientShowPath(companyId)}
                  />
                </>
              ) : (
                <span>{ticket.requester_name || ticket.requester_email || "Unknown"}</span>
              )}
              <span>·</span>
              <span>{getTicketClaimLabel(ticket)}</span>
              {ticket.deal_id ? (
                <>
                  <span>·</span>
                  <Link
                    to={`/deals/${ticket.deal_id}/show`}
                    className="font-medium text-primary hover:underline"
                  >
                    View deal
                  </Link>
                  {deal?.name ? (
                    <span className="hidden text-muted-foreground lg:inline">
                      ({deal.name})
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
            {mergedChildren.length > 0 ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Includes merged tickets:{" "}
                {mergedChildren
                  .map((child) => `#${child.id} (${child.subject})`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-background">
        <TicketReplyForm key={`reply-${ticket.id}`} ticket={ticket} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <TicketReadCutoffContext.Provider value={readCutoff}>
          <ReferenceManyField<Ticket, TicketMessage>
            key={`messages-${ticket.id}`}
            reference="ticket_messages"
            target="ticket_id"
            record={ticket}
            sort={{ field: "created_at", order: "DESC" }}
          >
            <TicketThread />
          </ReferenceManyField>
        </TicketReadCutoffContext.Provider>
      </div>
    </div>
  );
};
