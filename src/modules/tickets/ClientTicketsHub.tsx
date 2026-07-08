import { useMemo, useState } from "react";
import { useGetList, useRefresh } from "ra-core";
import { useNavigate } from "react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { ClientInvoice, OrganizationMember, Ticket } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import {
  countClientHubTickets,
  filterClientHubTickets,
  type ClientTicketScope,
} from "@/modules/tickets/clientTicketScope";
import { ClientTicketStatusFilter } from "@/modules/tickets/ClientTicketStatusFilter";
import { EditTicketDialog } from "@/modules/tickets/EditTicketDialog";
import { TicketInboxBulkBar } from "@/modules/tickets/TicketInboxBulkBar";
import { TicketListItem } from "@/modules/tickets/TicketListItem";
import type { TicketStatusFilterId } from "@/modules/tickets/ticketInboxConfig";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import { useClientScopedTickets } from "@/modules/tickets/useClientScopedTickets";
import { useTicketListAttachments } from "@/modules/tickets/useTicketListAttachments";
import { useTicketListMessagePreviews } from "@/modules/tickets/useTicketListMessagePreviews";
import { useTicketInboxReads } from "@/modules/tickets/useTicketInboxReads";

type ClientTicketsHubProps = {
  companyId?: Company["id"];
  contactId?: Contact["id"];
  scope?: ClientTicketScope;
  className?: string;
};

const SummaryCard = ({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-xl border bg-card px-4 py-3 shadow-xs",
      className,
    )}
  >
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
  </div>
);

const HubLoading = () => (
  <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

export const ClientTicketsHub = ({
  companyId,
  contactId,
  scope = companyId != null ? "company" : "contact",
  className,
}: ClientTicketsHubProps) => {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const canManage = useMemberCapability("support.tickets.manage");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilterId>("all");
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);

  const { tickets, isPending } = useClientScopedTickets({
    companyId,
    contactId,
    scope,
  });

  const counts = useMemo(() => countClientHubTickets(tickets), [tickets]);
  const visibleTickets = useMemo(
    () => filterClientHubTickets(tickets, statusFilter),
    [statusFilter, tickets],
  );

  const ticketIds = useMemo(() => visibleTickets.map((ticket) => ticket.id), [
    visibleTickets,
  ]);
  const ticketIdStrings = useMemo(
    () => ticketIds.map((id) => String(id)),
    [ticketIds],
  );

  const readMap = useTicketInboxReads(ticketIdStrings);
  const attachmentMap = useTicketListAttachments(ticketIds);
  const messagePreviewMap = useTicketListMessagePreviews(ticketIds);

  const hasAttachmentsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const [ticketId, files] of attachmentMap.entries()) {
      map.set(ticketId, files.length > 0);
    }
    return map;
  }, [attachmentMap]);

  const companyIds = useMemo(
    () => [
      ...new Set(
        visibleTickets
          .map((ticket) => ticket.company_id)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ],
    [visibleTickets],
  );
  const contactIds = useMemo(
    () => [
      ...new Set(
        visibleTickets
          .map((ticket) => ticket.contact_id)
          .filter((id): id is NonNullable<typeof id> => id != null),
      ),
    ],
    [visibleTickets],
  );

  const { data: companies = [] } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: Math.max(companyIds.length, 1) },
    filter:
      companyIds.length > 0 ? { "id@in": `(${companyIds.join(",")})` } : undefined,
    queryOptions: { enabled: companyIds.length > 0, staleTime: 30_000 },
  });
  const { data: contacts = [] } = useGetList<Contact>("contacts_summary", {
    pagination: { page: 1, perPage: Math.max(contactIds.length, 1) },
    filter:
      contactIds.length > 0 ? { "id@in": `(${contactIds.join(",")})` } : undefined,
    queryOptions: { enabled: contactIds.length > 0, staleTime: 30_000 },
  });
  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const linkedInvoiceIds = useMemo(
    () => [
      ...new Set(
        visibleTickets
          .map((ticket) => ticket.invoice_id)
          .filter((id): id is number | string => id != null)
          .map((id) => String(id)),
      ),
    ],
    [visibleTickets],
  );

  const { data: ticketInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: Math.max(ticketIds.length * 4, 1) },
      sort: { field: "id", order: "ASC" },
      filter:
        ticketIds.length > 0
          ? { "ticket_id@in": `(${ticketIds.join(",")})` }
          : undefined,
    },
    { enabled: ticketIds.length > 0, staleTime: 30_000 },
  );

  const { data: linkedInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: Math.max(linkedInvoiceIds.length, 1) },
      sort: { field: "id", order: "ASC" },
      filter:
        linkedInvoiceIds.length > 0
          ? { "id@in": `(${linkedInvoiceIds.join(",")})` }
          : undefined,
    },
    { enabled: linkedInvoiceIds.length > 0, staleTime: 30_000 },
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((contact) => [String(contact.id), contact])),
    [contacts],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [String(member.id), member])),
    [members],
  );

  const invoicesByTicketId = useMemo(() => {
    const map = new Map<string, ClientInvoice[]>();
    for (const invoice of [...ticketInvoices, ...linkedInvoices]) {
      const ticketId =
        invoice.ticket_id != null ? String(invoice.ticket_id) : null;
      if (!ticketId) continue;
      const current = map.get(ticketId) ?? [];
      current.push(invoice);
      map.set(ticketId, current);
    }
    return map;
  }, [linkedInvoices, ticketInvoices]);

  const selectedTickets = useMemo(
    () =>
      visibleTickets.filter((ticket) =>
        selectedTicketIds.includes(String(ticket.id)),
      ),
    [selectedTicketIds, visibleTickets],
  );

  const allVisibleSelected =
    visibleTickets.length > 0 &&
    visibleTickets.every((ticket) =>
      selectedTicketIds.includes(String(ticket.id)),
    );

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedTicketIds(visibleTickets.map((ticket) => String(ticket.id)));
      return;
    }
    setSelectedTicketIds([]);
  };

  const toggleTicketSelection = (ticketId: string, checked: boolean) => {
    setSelectedTicketIds((current) =>
      checked
        ? [...new Set([...current, ticketId])]
        : current.filter((id) => id !== ticketId),
    );
  };

  if (isPending) return <HubLoading />;

  if (!tickets.length) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex justify-end">
          <CreateTicketButton companyId={companyId} contactId={contactId} />
        </div>
        <ClientTabEmpty message="No support tickets for this client yet." />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 pb-20", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="All tickets" value={counts.all} />
          <SummaryCard label="Open" value={counts.open} />
          <SummaryCard label="Waiting" value={counts.waiting} />
          <SummaryCard label="Resolved" value={counts.resolved} />
        </div>
        <CreateTicketButton companyId={companyId} contactId={contactId} />
      </div>

      <ClientTicketStatusFilter
        active={statusFilter}
        counts={counts}
        onSelect={setStatusFilter}
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        {!visibleTickets.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No tickets match this filter.
          </p>
        ) : (
          <>
            {canManage ? (
              <div className="flex items-center gap-2 border-b px-4 py-2">
                <Checkbox
                  id="client-tickets-select-all"
                  checked={allVisibleSelected}
                  onCheckedChange={(value) => toggleAllVisible(value === true)}
                />
                <Label
                  htmlFor="client-tickets-select-all"
                  className="text-xs text-muted-foreground"
                >
                  Select all
                </Label>
              </div>
            ) : null}
            <ul>
              {visibleTickets.map((ticket) => {
                const ticketId = String(ticket.id);
                return (
                  <TicketListItem
                    key={ticket.id}
                    ticket={ticket}
                    selected={false}
                    bulkSelected={selectedTicketIds.includes(ticketId)}
                    selectionEnabled={canManage}
                    canManage={canManage}
                    company={
                      ticket.company_id
                        ? companyById.get(String(ticket.company_id))
                        : null
                    }
                    contact={
                      ticket.contact_id
                        ? contactById.get(String(ticket.contact_id))
                        : null
                    }
                    assignee={
                      ticket.assignee_id
                        ? memberById.get(String(ticket.assignee_id))
                        : null
                    }
                    members={members}
                    hasAttachments={hasAttachmentsMap.get(ticketId) ?? false}
                    invoices={invoicesByTicketId.get(ticketId) ?? []}
                    messagePreview={messagePreviewMap.get(ticketId)}
                    onSelect={() =>
                      navigate(ticketShowPath(ticket.id, statusFilter))
                    }
                    onToggleBulkSelect={(checked) =>
                      toggleTicketSelection(ticketId, checked)
                    }
                    onEdit={setTicketToEdit}
                    onUpdated={refresh}
                    lastReadAt={readMap.get(ticketId) ?? null}
                  />
                );
              })}
            </ul>
          </>
        )}
      </div>

      <TicketInboxBulkBar
        selectedTickets={selectedTickets}
        companyById={companyById}
        contactById={contactById}
        onClear={() => setSelectedTicketIds([])}
        onMerged={() => {
          setSelectedTicketIds([]);
          refresh();
        }}
      />

      <EditTicketDialog
        ticket={ticketToEdit}
        open={ticketToEdit != null}
        onOpenChange={(open) => {
          if (!open) setTicketToEdit(null);
        }}
        onSaved={refresh}
      />
    </div>
  );
};
