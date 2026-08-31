import { useGetList, useListContext } from "ra-core";
import { useMemo, useRef, useState } from "react";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  OrganizationMember,
  Ticket,
} from "@/modules/types";
import { EditTicketDialog } from "@/modules/tickets/EditTicketDialog";
import { TicketKanbanCard } from "@/modules/tickets/TicketKanbanCard";
import {
  normalizeTicketServiceTypes,
  TICKET_SERVICE_TYPE_OPTIONS,
  type TicketServiceTypeId,
} from "@/modules/tickets/ticketKanbanCardMeta";
import { matchesTicketSearch } from "@/modules/tickets/ticketInboxQueue";
import { useTicketInboxReads } from "@/modules/tickets/useTicketInboxReads";

const UNCLASSIFIED_COLUMN_ID = "unclassified" as const;

type TypeColumnId = TicketServiceTypeId | typeof UNCLASSIFIED_COLUMN_ID;

const TYPE_COLUMNS: { id: TypeColumnId; label: string }[] = [
  ...TICKET_SERVICE_TYPE_OPTIONS.map((option) => ({
    id: option.id as TypeColumnId,
    label: option.label,
  })),
  { id: UNCLASSIFIED_COLUMN_ID, label: "Unclassified" },
];

const groupTicketsByType = (
  tickets: Ticket[],
): Record<TypeColumnId, Ticket[]> => {
  const buckets = Object.fromEntries(
    TYPE_COLUMNS.map((column) => [column.id, [] as Ticket[]]),
  ) as Record<TypeColumnId, Ticket[]>;

  for (const ticket of tickets) {
    const types = normalizeTicketServiceTypes(ticket.service_types);
    if (types.length === 0) {
      buckets[UNCLASSIFIED_COLUMN_ID].push(ticket);
      continue;
    }
    for (const type of types) {
      buckets[type].push(ticket);
    }
  }
  return buckets;
};

export const TicketsByType = ({
  selectedTicketId,
  onSelectTicket,
  searchQuery = "",
  statusFilter = "all",
  selectedTicketIds = [],
  onToggleTicketSelection,
  selectionEnabled = false,
}: {
  selectedTicketId?: string | null;
  onSelectTicket: (ticketId: string) => void;
  searchQuery?: string;
  statusFilter?: string;
  selectedTicketIds?: string[];
  onToggleTicketSelection?: (ticketId: string, checked: boolean) => void;
  selectionEnabled?: boolean;
}) => {
  const { data = [], isPending, refetch } = useListContext<Ticket>();
  const canManage = useMemberCapability("support.tickets.manage");
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(boardRef);

  const allTickets = useMemo(
    () =>
      (data ?? []).filter((ticket) => ticket.merged_into_ticket_id == null),
    [data],
  );

  const ticketIds = useMemo(
    () => allTickets.map((ticket) => String(ticket.id)),
    [allTickets],
  );
  const companyIds = useMemo(
    () =>
      [
        ...new Set(
          allTickets
            .map((ticket) => ticket.company_id)
            .filter((id) => id != null)
            .map(Number),
        ),
      ],
    [allTickets],
  );
  const contactIds = useMemo(
    () =>
      [
        ...new Set(
          allTickets
            .map((ticket) => ticket.contact_id)
            .filter((id) => id != null)
            .map(Number),
        ),
      ],
    [allTickets],
  );
  const linkedInvoiceIds = useMemo(
    () => [
      ...new Set(
        allTickets
          .map((ticket) => ticket.invoice_id)
          .filter((id): id is number | string => id != null)
          .map((id) => String(id)),
      ),
    ],
    [allTickets],
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
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    },
  );
  const { data: ticketInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: Math.max(ticketIds.length * 4, 1) },
      sort: { field: "id", order: "ASC" },
      filter: ticketIds.length
        ? { "ticket_id@in": `(${ticketIds.join(",")})` }
        : undefined,
    },
    { enabled: ticketIds.length > 0 },
  );
  const { data: linkedInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: Math.max(linkedInvoiceIds.length, 1) },
      sort: { field: "id", order: "ASC" },
      filter: linkedInvoiceIds.length
        ? { "id@in": `(${linkedInvoiceIds.join(",")})` }
        : undefined,
    },
    { enabled: linkedInvoiceIds.length > 0 },
  );

  const readMap = useTicketInboxReads(ticketIds);

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
  const invoicesByTicketId = useMemo(() => {
    const map = new Map<string, ClientInvoice[]>();
    const push = (ticketId: string, invoice: ClientInvoice) => {
      const list = map.get(ticketId) ?? [];
      if (!list.some((row) => String(row.id) === String(invoice.id))) {
        list.push(invoice);
      }
      map.set(ticketId, list);
    };
    for (const invoice of ticketInvoices) {
      if (invoice.ticket_id != null) {
        push(String(invoice.ticket_id), invoice);
      }
    }
    for (const ticket of allTickets) {
      if (ticket.invoice_id == null) continue;
      const linked = linkedInvoices.find(
        (invoice) => String(invoice.id) === String(ticket.invoice_id),
      );
      if (linked) push(String(ticket.id), linked);
    }
    return map;
  }, [linkedInvoices, ticketInvoices, allTickets]);

  const tickets = useMemo(() => {
    const trimmed = searchQuery.trim();
    const searched = !trimmed
      ? allTickets
      : allTickets.filter((ticket) => {
          const company =
            ticket.company_id != null
              ? companiesById.get(Number(ticket.company_id))
              : null;
          const contact =
            ticket.contact_id != null
              ? contactsById.get(Number(ticket.contact_id))
              : null;
          const contactName = contact
            ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
            : company?.name;
          return matchesTicketSearch(ticket, trimmed, {
            email: company?.primary_contact_email_jsonb?.find((entry) =>
              entry.email?.trim(),
            )?.email,
            phone: company?.phone_number,
            contactName,
          });
        });
    if (!statusFilter || statusFilter === "all") return searched;
    return searched.filter((ticket) => ticket.status === statusFilter);
  }, [allTickets, companiesById, contactsById, searchQuery, statusFilter]);

  const ticketsByType = useMemo(() => groupTicketsByType(tickets), [tickets]);

  if (isPending) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Loading tickets…
      </p>
    );
  }

  return (
    <>
      <div
        ref={boardRef}
        className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden pb-2"
      >
        {TYPE_COLUMNS.map((column) => {
          const columnTickets = ticketsByType[column.id] ?? [];
          return (
            <div
              key={column.id}
              className="flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/20"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <p className="text-sm font-medium">{column.label}</p>
                <span className="rounded-md bg-background px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {columnTickets.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {columnTickets.map((ticket) => {
                  const ticketId = String(ticket.id);
                  const selected = selectedTicketId === ticketId;
                  const bulkSelected = selectedTicketIds.includes(ticketId);
                  const assigneeId = ticket.assignee_id;
                  return (
                    <button
                      key={`${column.id}:${ticketId}`}
                      type="button"
                      onClick={() => onSelectTicket(ticketId)}
                      className={cn(
                        "w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "ring-2 ring-primary/40",
                      )}
                    >
                      <TicketKanbanCard
                        ticket={ticket}
                        company={
                          ticket.company_id != null
                            ? companiesById.get(Number(ticket.company_id))
                            : null
                        }
                        contact={
                          ticket.contact_id != null
                            ? contactsById.get(Number(ticket.contact_id))
                            : null
                        }
                        assignee={
                          assigneeId != null
                            ? membersById.get(Number(assigneeId))
                            : null
                        }
                        members={members}
                        invoices={invoicesByTicketId.get(ticketId) ?? []}
                        lastReadAt={readMap.get(ticketId) ?? null}
                        bulkSelected={bulkSelected}
                        selectionEnabled={selectionEnabled}
                        canManage={canManage}
                        onToggleBulkSelect={(checked) =>
                          onToggleTicketSelection?.(ticketId, checked)
                        }
                        onEdit={canManage ? setTicketToEdit : undefined}
                        onUpdated={() => void refetch()}
                      />
                    </button>
                  );
                })}
                {columnTickets.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No tickets
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <EditTicketDialog
        ticket={ticketToEdit}
        open={ticketToEdit != null}
        onOpenChange={(open) => {
          if (!open) setTicketToEdit(null);
        }}
        onSaved={() => void refetch()}
      />
    </>
  );
};
