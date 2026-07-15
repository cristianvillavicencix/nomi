import { useGetList, useListContext } from "ra-core";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { OrganizationMember, Ticket } from "@/modules/types";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import {
  formatTicketListTime,
  memberDisplayName,
} from "@/modules/tickets/ticketInboxUi";
import { formatTicketCardSubject } from "@/modules/tickets/ticketOverviewConfig";
import {
  isElevatedTicketPriority,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";

export const TicketsOverviewTable = ({
  selectedTicketId,
  onSelectTicket,
}: {
  selectedTicketId?: string | null;
  onSelectTicket: (ticketId: string) => void;
}) => {
  const { data = [], isPending } = useListContext<Ticket>();

  const tickets = useMemo(
    () =>
      (data ?? []).filter((ticket) => ticket.merged_into_ticket_id == null),
    [data],
  );

  const companyIds = useMemo(
    () =>
      [
        ...new Set(
          tickets
            .map((ticket) => ticket.company_id)
            .filter((id) => id != null)
            .map(Number),
        ),
      ],
    [tickets],
  );
  const contactIds = useMemo(
    () =>
      [
        ...new Set(
          tickets
            .map((ticket) => ticket.contact_id)
            .filter((id) => id != null)
            .map(Number),
        ),
      ],
    [tickets],
  );
  const assigneeIds = useMemo(
    () =>
      [
        ...new Set(
          tickets
            .map(
              (ticket) =>
                ticket.assignee_id ?? ticket.organization_member_id ?? null,
            )
            .filter((id): id is number => id != null)
            .map(Number),
        ),
      ],
    [tickets],
  );

  const { data: companies = [] } = useGetList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: Math.max(companyIds.length, 1) },
      filter: companyIds.length ? { "id@in": `(${companyIds.join(",")})` } : {},
    },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: Math.max(contactIds.length, 1) },
      filter: contactIds.length ? { "id@in": `(${contactIds.join(",")})` } : {},
    },
    { enabled: contactIds.length > 0 },
  );
  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: Math.max(assigneeIds.length, 1) },
      filter: assigneeIds.length
        ? { "id@in": `(${assigneeIds.join(",")})` }
        : {},
    },
    { enabled: assigneeIds.length > 0 },
  );

  const companiesById = useMemo(() => {
    const map = new Map<number, Company>();
    for (const company of companies) map.set(Number(company.id), company);
    return map;
  }, [companies]);
  const contactsById = useMemo(() => {
    const map = new Map<number, Contact>();
    for (const contact of contacts) map.set(Number(contact.id), contact);
    return map;
  }, [contacts]);
  const membersById = useMemo(() => {
    const map = new Map<number, OrganizationMember>();
    for (const member of members) map.set(Number(member.id), member);
    return map;
  }, [members]);

  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading tickets…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No tickets yet.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Ticket</th>
            <th className="px-3 py-2.5 font-medium">Subject</th>
            <th className="px-3 py-2.5 font-medium">Client</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Assignee</th>
            <th className="px-3 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const ticketId = String(ticket.id);
            const company =
              ticket.company_id != null
                ? companiesById.get(Number(ticket.company_id))
                : null;
            const contact =
              ticket.contact_id != null
                ? contactsById.get(Number(ticket.contact_id))
                : null;
            const assigneeId =
              ticket.assignee_id ?? ticket.organization_member_id ?? null;
            const assignee =
              assigneeId != null ? membersById.get(Number(assigneeId)) : null;
            const clientLabel =
              company?.name?.trim() ||
              [contact?.first_name, contact?.last_name]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              ticket.requester_name?.trim() ||
              ticket.requester_email?.trim() ||
              "—";
            const selected = selectedTicketId === ticketId;

            return (
              <tr
                key={ticket.id}
                className={cn(
                  "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40",
                  selected && "bg-primary/5 hover:bg-primary/10",
                )}
                onClick={() => onSelectTicket(ticketId)}
              >
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  #{ticket.id}
                </td>
                <td className="max-w-[280px] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {formatTicketCardSubject(ticket.subject)}
                    </span>
                    {isElevatedTicketPriority(ticket) ? (
                      <Badge
                        variant="outline"
                        className="h-5 shrink-0 px-1.5 text-[10px]"
                      >
                        {ticketPriorityLabel(ticket.priority)}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-muted-foreground">
                  {clientLabel}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant={ticketStatusVariant(ticket.status)}
                    className={cn("capitalize")}
                  >
                    {ticketStatusLabel(ticket.status)}
                  </Badge>
                </td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-muted-foreground">
                  {assignee ? memberDisplayName(assignee) : "Unassigned"}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {formatTicketListTime(ticket.updated_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
