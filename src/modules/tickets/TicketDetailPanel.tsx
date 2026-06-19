import { Building2, Globe, Mail, Phone, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGetList, useGetOne, useUpdate } from "ra-core";
import { Link } from "react-router";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Deal, Ticket, TicketMessage } from "@/modules/types";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { resolveTicketRequesterName } from "@/modules/tickets/ticketRequester";
import { TicketReplyForm } from "@/modules/tickets/TicketReplyForm";
import { TicketBillingSidePanel } from "@/modules/tickets/TicketBillingSidePanel";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import { TicketThread } from "@/modules/tickets/TicketThread";
import { TicketReadCutoffContext } from "@/modules/tickets/TicketReadCutoffContext";
import { useTicketMemberRead } from "@/modules/tickets/useTicketInboxReads";
import { getTicketClaimLabel } from "@/modules/tickets/ticketInboxUi";
import { getClientShowPath } from "@/app/routing";
import { cn } from "@/lib/utils";

const websiteHref = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, "")}`;

const MetaItem = ({
  icon: Icon,
  children,
  className,
}: {
  icon: typeof Mail;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground",
      className,
    )}
  >
    <Icon className="size-3.5 shrink-0 opacity-70" />
    <span className="min-w-0 truncate">{children}</span>
  </span>
);

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
      { mutationMode: "optimistic" },
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

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#fcfcfb]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b bg-background px-5 py-3.5">
          <div className="space-y-2">
            <div className="min-w-0 space-y-2">
              <TicketSubjectField
                key={`subject-${ticket.id}`}
                ticket={ticket}
                className="text-lg font-semibold leading-snug"
                inputClassName="text-lg font-semibold"
              />

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {companyName && ticket.company_id ? (
                    <MetaItem icon={Building2}>
                      <Link
                        to={getClientShowPath(ticket.company_id)}
                        className="font-medium text-foreground hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {companyName}
                      </Link>
                    </MetaItem>
                  ) : null}
                  {contactName ? (
                    <MetaItem icon={UserRound}>
                      <span className="text-foreground/90">{contactName}</span>
                    </MetaItem>
                  ) : null}
                  {!companyName && !contactName ? (
                    <span className="text-sm text-muted-foreground">
                      {ticket.requester_name ||
                        ticket.requester_email ||
                        getTicketClaimLabel(ticket)}
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      {getTicketClaimLabel(ticket)}
                    </span>
                  )}
                </div>

                {meta.email || meta.phone || meta.website ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {meta.email ? (
                      <MetaItem icon={Mail}>
                        <a
                          href={`mailto:${meta.email}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {meta.email}
                        </a>
                      </MetaItem>
                    ) : null}
                    {meta.phone ? (
                      <MetaItem icon={Phone}>
                        <a
                          href={`tel:${meta.phone.replace(/\s+/g, "")}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {meta.phone}
                        </a>
                      </MetaItem>
                    ) : null}
                    {meta.website ? (
                      <MetaItem icon={Globe}>
                        <a
                          href={websiteHref(meta.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground hover:underline"
                        >
                          {meta.website.replace(/^https?:\/\//i, "")}
                        </a>
                      </MetaItem>
                    ) : null}
                  </div>
                ) : null}

                {ticket.deal_id ? (
                  <div className="text-sm">
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

      <TicketBillingSidePanel
        ticket={ticket}
        company={company}
        contact={contact}
      />
    </div>
  );
};
