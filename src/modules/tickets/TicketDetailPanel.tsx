import { useEffect, useRef, useState } from "react";
import { useGetList, useGetOne, useUpdate } from "ra-core";
import { Link } from "react-router";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Deal, Ticket, TicketMessage } from "@/modules/types";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
import { resolveTicketRequesterName } from "@/modules/tickets/ticketRequester";
import { TicketReplyForm } from "@/modules/tickets/TicketReplyForm";
import { TicketBillingSidePanel } from "@/modules/tickets/TicketBillingSidePanel";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import { TicketThread } from "@/modules/tickets/TicketThread";
import { TicketReadCutoffContext } from "@/modules/tickets/TicketReadCutoffContext";
import { useAutoLinkTicketRequester } from "@/modules/tickets/useAutoLinkTicketRequester";
import { useTicketMemberRead } from "@/modules/tickets/useTicketInboxReads";
import { getClientShowPath } from "@/app/routing";

import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

const websiteHref = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, "")}`;

const websiteLabel = (value: string) => {
  const label = value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return label ? `${label}/` : "";
};

export const TicketDetailPanel = ({ ticketId }: { ticketId: string }) => {
  const { lastReadAt, isLoading: isReadLoading, markRead } =
    useTicketMemberRead(ticketId);
  const [readCutoff, setReadCutoff] = useState<string | null | undefined>(
    undefined,
  );
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

  const meta = getTicketListMeta(ticket, company, contact);
  const contactName = resolveTicketRequesterName(ticket, contact, company);
  const companyName = company?.name?.trim() || null;
  const displayPhone = meta.phone
    ? formatUsPhoneDisplayFromAny(meta.phone)
    : null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b bg-background px-5 py-3.5">
          <div className="min-w-0 space-y-1.5">
            <p className="flex min-w-0 flex-wrap items-baseline gap-y-0.5 leading-snug">
              <TicketSubjectField
                key={`subject-${ticket.id}`}
                ticket={ticket}
                className="text-lg font-semibold tracking-tight text-foreground"
                inputClassName="text-lg font-semibold"
              />
              {companyName && ticket.company_id ? (
                <>
                  <TicketMetaSep tone="soft" />
                  <Link
                    to={getClientShowPath(ticket.company_id)}
                    className="text-[15px] text-muted-foreground transition-colors hover:text-foreground hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {companyName}
                  </Link>
                </>
              ) : null}
              {contactName ? (
                <>
                  <TicketMetaSep tone="soft" />
                  <span className="text-[15px] text-muted-foreground">
                    {contactName}
                  </span>
                </>
              ) : null}
            </p>

            <p className="flex min-w-0 flex-wrap items-baseline gap-y-0.5 text-[15px] leading-snug text-muted-foreground">
              <span>Ticket #{ticket.id}</span>
              {meta.email ? (
                <>
                  <TicketMetaSep tone="soft" />
                  <a
                    href={`mailto:${meta.email}`}
                    className="transition-colors hover:text-foreground hover:underline"
                  >
                    {meta.email}
                  </a>
                </>
              ) : null}
              {displayPhone ? (
                <>
                  <TicketMetaSep tone="soft" />
                  <a
                    href={`tel:${meta.phone?.replace(/\s+/g, "") ?? ""}`}
                    className="transition-colors hover:text-foreground hover:underline"
                  >
                    {displayPhone}
                  </a>
                </>
              ) : null}
              {meta.website ? (
                <>
                  <TicketMetaSep tone="soft" />
                  <a
                    href={websiteHref(meta.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-foreground hover:underline"
                  >
                    {websiteLabel(meta.website)}
                  </a>
                </>
              ) : null}
            </p>

            {ticket.deal_id ? (
              <div className="pt-1 text-sm">
                <Link
                  to={`/deals/${ticket.deal_id}/show`}
                  className="font-medium text-primary hover:underline"
                >
                  View deal
                </Link>
                {deal?.name ? (
                  <span className="ml-1.5 text-muted-foreground">
                    ({deal.name})
                  </span>
                ) : null}
              </div>
            ) : null}

            {mergedChildren.length > 0 ? (
              <p className="border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
                Includes merged tickets:{" "}
                {mergedChildren
                  .map((child) => `#${child.id} (${child.subject})`)
                  .join(", ")}
              </p>
            ) : null}
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

      <TicketBillingSidePanel
        ticket={ticket}
        company={company}
        contact={contact}
      />
    </div>
  );
};
