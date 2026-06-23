import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useDelete,
  useGetIdentity,
  useGetList,
  useListContext,
  useListFilterContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { useNavigate, useParams } from "react-router";
import { List } from "@/components/admin/list";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageActions, PageTitle } from "@/components/atomic-crm/layout/PageActions";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import { EditTicketDialog } from "@/modules/tickets/EditTicketDialog";
import { TicketDetailPanel } from "@/modules/tickets/TicketDetailPanel";
import { TicketInboxBulkBar } from "@/modules/tickets/TicketInboxBulkBar";
import { TicketListItem } from "@/modules/tickets/TicketListItem";
import { TicketStatusBreadcrumb } from "@/modules/tickets/TicketStatusBreadcrumb";
import {
  DEFAULT_TICKET_INBOX_EMAIL,
  type TicketStatusFilterId,
} from "@/modules/tickets/ticketInboxConfig";
import {
  buildTicketInboxStatusFilter,
  countTicketsByInboxFilter,
} from "@/modules/tickets/ticketStatusWorkflow";
import { useTicketListAttachments } from "@/modules/tickets/useTicketListAttachments";
import { useTicketsInboxRealtime } from "@/modules/tickets/useTicketsInboxRealtime";
import { useTicketInboxReads } from "@/modules/tickets/useTicketInboxReads";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { ClientInvoice, OrganizationMember, Ticket } from "@/modules/types";

export const TicketsInbox = () => {
  const { identity } = useGetIdentity();
  const { id } = useParams();
  const isMobile = useIsMobile();

  useTicketsInboxRealtime(Boolean(identity));

  if (!identity) return null;

  if (isMobile && id) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <TicketDetailPanel key={id} ticketId={id} />
      </div>
    );
  }

  return (
    <List
      resource="tickets"
      title={false}
      disableBreadcrumb
      contentScrollable={false}
      pagination={false}
      perPage={50}
      sort={{ field: "updated_at", order: "DESC" }}
      filter={{
        "merged_into_ticket_id@is": null,
      }}
      filterDefaultValues={{
        "status@neq": "resolved",
      }}
      queryOptions={{ refetchInterval: 30_000 }}
      actions={
        <PageActions>
          <Inbox className="size-4 shrink-0 text-muted-foreground" />
          <PageTitle label="Tickets" />
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {DEFAULT_TICKET_INBOX_EMAIL}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <CreateTicketButton />
          </div>
        </PageActions>
      }
    >
      <TicketsInboxLayout selectedId={id ?? null} />
    </List>
  );
};

const TicketsInboxLayout = ({ selectedId }: { selectedId: string | null }) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [deleteOne] = useDelete();
  const isMobile = useIsMobile();
  const canManage = useMemberCapability("support.tickets.manage");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilterId>("all");
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const { filterValues, setFilters } = useListFilterContext();
  const { data: tickets = [] } = useListContext<Ticket>();

  const { data: allTickets = [] } = useGetList<Ticket>("tickets", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "updated_at", order: "DESC" },
    filter: { "merged_into_ticket_id@is": null },
    queryOptions: { refetchInterval: 30_000 },
  });

  const counts = useMemo(
    () => countTicketsByInboxFilter(allTickets),
    [allTickets],
  );

  const ticketIds = useMemo(() => tickets.map((ticket) => ticket.id), [tickets]);
  const ticketIdStrings = useMemo(
    () => ticketIds.map((id) => String(id)),
    [ticketIds],
  );
  const readMap = useTicketInboxReads(ticketIdStrings);
  const companyIds = useMemo(
    () =>
      [
        ...new Set(
          tickets
            .map((ticket) => ticket.company_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
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
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ],
    [tickets],
  );
  const attachmentMap = useTicketListAttachments(ticketIds);
  const hasAttachmentsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const [ticketId, files] of attachmentMap.entries()) {
      map.set(ticketId, files.length > 0);
    }
    return map;
  }, [attachmentMap]);

  const { data: companies = [] } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: Math.max(companyIds.length, 1) },
    filter:
      companyIds.length > 0 ? { "id@in": `(${companyIds.join(",")})` } : undefined,
    queryOptions: { enabled: companyIds.length > 0 },
  });
  const { data: contacts = [] } = useGetList<Contact>("contacts_summary", {
    pagination: { page: 1, perPage: Math.max(contactIds.length, 1) },
    filter:
      contactIds.length > 0 ? { "id@in": `(${contactIds.join(",")})` } : undefined,
    queryOptions: { enabled: contactIds.length > 0 },
  });
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
      filter:
        ticketIds.length > 0
          ? { "ticket_id@in": `(${ticketIds.join(",")})` }
          : undefined,
    },
    { enabled: ticketIds.length > 0 },
  );

  const invoicesByTicketId = useMemo(() => {
    const map = new Map<string, ClientInvoice[]>();
    for (const invoice of ticketInvoices) {
      if (invoice.ticket_id == null) continue;
      const key = String(invoice.ticket_id);
      const current = map.get(key) ?? [];
      current.push(invoice);
      map.set(key, current);
    }
    return map;
  }, [ticketInvoices]);

  const companyById = useMemo(() => {
    const map = new Map<string, Company>();
    for (const company of companies) {
      map.set(String(company.id), company);
    }
    return map;
  }, [companies]);
  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);
  const memberById = useMemo(() => {
    const map = new Map<string, OrganizationMember>();
    for (const member of members) {
      map.set(String(member.id), member);
    }
    return map;
  }, [members]);

  const selectedTickets = useMemo(
    () =>
      tickets.filter((ticket) => selectedTicketIds.includes(String(ticket.id))),
    [tickets, selectedTicketIds],
  );

  const allVisibleSelected =
    tickets.length > 0 &&
    tickets.every((ticket) => selectedTicketIds.includes(String(ticket.id)));

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedTicketIds(tickets.map((ticket) => String(ticket.id)));
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

  const clearSelection = () => setSelectedTicketIds([]);

  const handleBulkMerged = (primaryTicketId: string | number) => {
    navigate(`/tickets/${primaryTicketId}/show`);
  };

  const handleSearch = (value: string) => {
    const next = { ...filterValues };
    if (value.trim()) {
      next["subject@ilike"] = `%${value.trim()}%`;
    } else {
      delete next["subject@ilike"];
    }
    setFilters(next, {});
  };

  const handleStatusFilter = (status: TicketStatusFilterId) => {
    setStatusFilter(status);
    const next = { ...filterValues };
    delete next["status@eq"];
    delete next["status@neq"];
    Object.assign(next, buildTicketInboxStatusFilter(status));
    setFilters(next, {});
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;
    setDeletePending(true);
    try {
      await deleteOne("tickets", {
        id: ticketToDelete.id,
        previousData: ticketToDelete,
      });
      notify("Ticket deleted", { type: "success" });
      if (String(selectedId) === String(ticketToDelete.id)) {
        navigate("/tickets");
      }
      setSelectedTicketIds((current) =>
        current.filter((id) => id !== String(ticketToDelete.id)),
      );
      refresh();
    } catch {
      notify("Could not delete ticket", { type: "error" });
    } finally {
      setDeletePending(false);
      setTicketToDelete(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid h-full min-h-0 flex-1 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)]">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden border-r",
            !isMobile && selectedId ? "hidden lg:flex" : "flex",
            isMobile && selectedId && "hidden",
          )}
        >
          <div className="shrink-0 space-y-3 border-b bg-background p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tickets, claims, clients..."
                className="pl-9"
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>
            <TicketStatusBreadcrumb
              active={statusFilter}
              counts={counts}
              onSelect={(status) => handleStatusFilter(status)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!tickets.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tickets in this inbox yet.
              </p>
            ) : (
              <>
                {canManage ? (
                  <div className="flex items-center gap-2 border-b px-4 py-2">
                    <Checkbox
                      id="tickets-select-all"
                      checked={allVisibleSelected}
                      onCheckedChange={(value) =>
                        toggleAllVisible(value === true)
                      }
                    />
                    <Label
                      htmlFor="tickets-select-all"
                      className="text-xs text-muted-foreground"
                    >
                      Select all on this page
                    </Label>
                  </div>
                ) : null}
                <ul>
                  {tickets.map((ticket) => {
                    const ticketId = String(ticket.id);
                    return (
                      <TicketListItem
                        key={ticket.id}
                        ticket={ticket}
                        selected={String(selectedId) === ticketId}
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
                        hasAttachments={
                          hasAttachmentsMap.get(ticketId) ?? false
                        }
                        invoices={invoicesByTicketId.get(ticketId) ?? []}
                        onSelect={() => navigate(`/tickets/${ticket.id}/show`)}
                        onToggleBulkSelect={(checked) =>
                          toggleTicketSelection(ticketId, checked)
                        }
                        onDelete={setTicketToDelete}
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
        </div>

        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            isMobile && !selectedId && "hidden",
            !isMobile && !selectedId && "hidden lg:flex",
          )}
        >
          {selectedId ? (
            <TicketDetailPanel key={selectedId} ticketId={selectedId} />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a ticket to read the thread and reply from{" "}
              {DEFAULT_TICKET_INBOX_EMAIL}.
            </div>
          )}
        </div>
      </div>

      {canManage ? (
        <TicketInboxBulkBar
          selectedTickets={selectedTickets}
          onClear={clearSelection}
          onMerged={handleBulkMerged}
        />
      ) : null}

      <EditTicketDialog
        ticket={ticketToEdit}
        open={ticketToEdit != null}
        onOpenChange={(open) => {
          if (!open) setTicketToEdit(null);
        }}
        onSaved={refresh}
      />

      <Dialog
        open={ticketToDelete != null}
        onOpenChange={(open) => {
          if (!open) setTicketToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete ticket #{ticketToDelete?.id ?? ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the ticket and its messages. This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setTicketToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={() => void handleDeleteTicket()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
