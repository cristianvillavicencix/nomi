import { Inbox, KanbanSquare, List as ListIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useGetList, useListContext } from "ra-core";
import { useNavigate, useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MobilePageChrome } from "@/components/atomic-crm/layout/MobilePageChrome";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BillingStatusFilterMenu } from "@/modules/billing/BillingStatusFilterMenu";
import { useMarkTicketNotificationsReadOnVisit } from "@/modules/notifications/useMarkTicketNotificationsReadOnVisit";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import {
  TICKET_STATUS_FILTERS,
  type TicketStatusFilterId,
} from "@/modules/tickets/ticketInboxConfig";
import {
  readPersistedTicketsOverviewView,
  TICKETS_OVERVIEW_VIEW_KEY,
  type TicketsOverviewView,
} from "@/modules/tickets/ticketOverviewConfig";
import { TicketInboxBulkBar } from "@/modules/tickets/TicketInboxBulkBar";
import { TicketOverviewPreview } from "@/modules/tickets/TicketOverviewPreview";
import {
  TICKET_PREVIEW_SHEET_CLASS,
  TICKET_PREVIEW_SHEET_EXPANDED_CLASS,
  ticketPreviewSheetTransition,
} from "@/modules/tickets/ticketContextLayout";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import { TicketListItem } from "@/modules/tickets/TicketListItem";
import { TicketsKanban } from "@/modules/tickets/TicketsKanban";
import { TicketsOverviewTable } from "@/modules/tickets/TicketsOverviewTable";
import { useTicketsInboxRealtime } from "@/modules/tickets/useTicketsInboxRealtime";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";

const OVERVIEW_LIST_FILTER = { "merged_into_ticket_id@is": null };

export const TicketsOverview = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<TicketsOverviewView>(() =>
    readPersistedTicketsOverviewView(),
  );

  const ticketParam = searchParams.get("ticket");
  const selectedTicketId =
    ticketParam && /^\d+$/.test(ticketParam) ? ticketParam : null;

  useTicketsInboxRealtime(Boolean(identity));
  useMarkTicketNotificationsReadOnVisit();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TICKETS_OVERVIEW_VIEW_KEY, view);
  }, [view]);

  // Drop legacy status filter query params on overview.
  useEffect(() => {
    if (!searchParams.has("status")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setSelectedTicketId = (ticketId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    if (ticketId) next.set("ticket", ticketId);
    else next.delete("ticket");
    setSearchParams(next, { replace: true });
  };

  const handleSelectTicket = (ticketId: string) => {
    if (isMobile) {
      navigate(ticketShowPath(ticketId));
      return;
    }
    setSelectedTicketId(ticketId);
  };

  if (!identity) return null;

  return (
    <List
      resource="tickets"
      title={false}
      disableBreadcrumb
      contentScrollable={false}
      pagination={view === "kanban" || isMobile ? false : undefined}
      perPage={view === "kanban" ? 200 : 50}
      sort={{ field: "updated_at", order: "DESC" }}
      filter={OVERVIEW_LIST_FILTER}
      disableSyncWithLocation
      storeKey={`tickets.overview.${view}`}
      queryOptions={{ refetchInterval: 30_000 }}
      className="mt-0 min-h-0 flex-1"
      actions={isMobile ? false : <TicketsOverviewActions />}
    >
      <TicketsOverviewBody
        view={view}
        onViewChange={setView}
        selectedTicketId={selectedTicketId}
        onSelectTicket={handleSelectTicket}
        onClearSelection={() => setSelectedTicketId(null)}
        isMobile={isMobile}
      />
    </List>
  );
};

const TicketsOverviewActions = () => {
  return (
    <PageActions>
      <Inbox className="size-4 shrink-0 text-muted-foreground" />
      <PageTitle label="Tickets" />
    </PageActions>
  );
};

const TicketsOverviewBody = ({
  view,
  onViewChange,
  selectedTicketId,
  onSelectTicket,
  onClearSelection,
  isMobile,
}: {
  view: TicketsOverviewView;
  onViewChange: (view: TicketsOverviewView) => void;
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  onClearSelection: () => void;
  isMobile: boolean;
}) => {
  const { total, data: tickets = [] } = useListContext<Ticket>();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<TicketStatusFilterId>("all");
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [previewContextExpanded, setPreviewContextExpanded] = useState(false);
  const canManage = useMemberCapability("support.tickets.manage");

  useEffect(() => {
    setSelectedTicketIds([]);
  }, [view]);

  useEffect(() => {
    setPreviewContextExpanded(false);
  }, [selectedTicketId]);

  const allTickets = useMemo(
    () =>
      (tickets ?? []).filter((ticket) => ticket.merged_into_ticket_id == null),
    [tickets],
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

  const { data: companies = [] } = useGetList<Company>(
    "companies",
    {
      pagination: { page: 1, perPage: Math.max(companyIds.length, 1) },
      filter: companyIds.length ? { "id@in": `(${companyIds.join(",")})` } : {},
    },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetList<Contact>(
    "contacts_summary",
    {
      pagination: { page: 1, perPage: Math.max(contactIds.length, 1) },
      filter: contactIds.length
        ? { "id@in": `(${contactIds.join(",")})` }
        : undefined,
    },
    { enabled: contactIds.length > 0 },
  );

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

  const selectedTickets = useMemo(
    () =>
      allTickets.filter((ticket) =>
        selectedTicketIds.includes(String(ticket.id)),
      ),
    [allTickets, selectedTicketIds],
  );

  const toggleTicketSelection = (ticketId: string, checked: boolean) => {
    setSelectedTicketIds((current) =>
      checked
        ? [...new Set([...current, ticketId])]
        : current.filter((id) => id !== ticketId),
    );
  };

  const clearBulkSelection = () => setSelectedTicketIds([]);

  const toggleAllVisible = (checked: boolean, visibleTicketIds: string[]) => {
    if (checked) {
      setSelectedTicketIds((current) => [
        ...new Set([...current, ...visibleTicketIds]),
      ]);
      return;
    }
    const visible = new Set(visibleTicketIds);
    setSelectedTicketIds((current) => current.filter((id) => !visible.has(id)));
  };

  const hasBulkSelection = selectedTicketIds.length > 0;

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const searched = !query
      ? allTickets
      : allTickets.filter((ticket) => {
          const company = companyById.get(String(ticket.company_id ?? ""));
          const contact = contactById.get(String(ticket.contact_id ?? ""));
          const haystack = [
            ticket.subject,
            ticket.id,
            company?.name,
            contact?.first_name,
            contact?.last_name,
            contact?.email,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        });
    if (statusFilter === "all") return searched;
    return searched.filter((ticket) => ticket.status === statusFilter);
  }, [allTickets, companyById, contactById, searchQuery, statusFilter]);

  const statusFilterCounts = useMemo(() => {
    const counts = {
      all: allTickets.length,
      new: 0,
      open: 0,
      waiting: 0,
      resolved: 0,
    } satisfies Record<TicketStatusFilterId, number>;
    for (const ticket of allTickets) {
      const status = ticket.status;
      if (
        status === "new" ||
        status === "open" ||
        status === "waiting" ||
        status === "resolved"
      ) {
        counts[status] += 1;
      }
    }
    return counts;
  }, [allTickets]);

  const ticketStatusFilterOptions = TICKET_STATUS_FILTERS.map((item) => ({
    value: item.id,
    label: item.label,
  }));

  if (isMobile) {
    return (
      <MobilePageChrome
        title="Tickets"
        action={<CreateTicketButton iconOnly />}
        scrollBody={view === "table"}
        search={
          <div className="space-y-2">
            <div className="flex w-full min-w-0 items-center gap-2">
              <BillingStatusFilterMenu
                value={statusFilter}
                onChange={setStatusFilter}
                options={ticketStatusFilterOptions}
                counts={statusFilterCounts}
                ariaLabel="Filter tickets"
              />
              <ModuleSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                basePlaceholder="Search tickets"
                total={filteredTickets.length}
                itemSingular="ticket"
                className="w-full min-w-0 flex-1 [&>div]:max-w-none"
              />
            </div>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => {
                if (value === "table" || value === "kanban") onViewChange(value);
              }}
              variant="outline"
              size="sm"
              className="w-full justify-start"
            >
              <ToggleGroupItem value="table" aria-label="List view" className="flex-1">
                <ListIcon className="size-4" />
                List
              </ToggleGroupItem>
              <ToggleGroupItem
                value="kanban"
                aria-label="Board view"
                className="flex-1"
              >
                <KanbanSquare className="size-4" />
                Board
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      >
        {view === "kanban" ? (
          <div className="min-h-0 flex-1 overflow-hidden pb-mobile-dock">
            <TicketsKanban
              onSelectTicket={onSelectTicket}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              selectionEnabled={false}
            />
          </div>
        ) : filteredTickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No tickets found.
          </p>
        ) : (
          <ul className="glass-grouped">
            {filteredTickets.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                selected={false}
                bulkSelected={false}
                selectionEnabled={false}
                canManage={false}
                company={companyById.get(String(ticket.company_id ?? ""))}
                contact={contactById.get(String(ticket.contact_id ?? ""))}
                onSelect={() => onSelectTicket(String(ticket.id))}
                onToggleBulkSelect={() => undefined}
              />
            ))}
          </ul>
        )}
      </MobilePageChrome>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden",
        hasBulkSelection && "pb-20",
      )}
    >
      <ModuleToolbar className="shrink-0">
        <ModuleSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          basePlaceholder="Search tickets by subject, requester, or client"
          total={total}
          itemSingular="ticket"
        />
        <ModuleToolbarActions>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === "table" || value === "kanban") onViewChange(value);
            }}
            variant="outline"
            size="sm"
            className="w-fit shrink-0"
          >
            <ToggleGroupItem value="table" aria-label="List view">
              <ListIcon className="size-4" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Board view">
              <KanbanSquare className="size-4" />
              Board
            </ToggleGroupItem>
          </ToggleGroup>
          <CreateTicketButton alwaysShowLabel />
        </ModuleToolbarActions>
      </ModuleToolbar>

      {view === "table" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TicketsOverviewTable
            selectedTicketId={selectedTicketId}
            onSelectTicket={onSelectTicket}
            searchQuery={searchQuery}
            selectedTicketIds={selectedTicketIds}
            onToggleTicketSelection={toggleTicketSelection}
            onToggleAllVisible={toggleAllVisible}
            selectionEnabled={canManage}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TicketsKanban
            selectedTicketId={selectedTicketId}
            onSelectTicket={onSelectTicket}
            searchQuery={searchQuery}
            selectedTicketIds={selectedTicketIds}
            onToggleTicketSelection={toggleTicketSelection}
            selectionEnabled={canManage}
          />
        </div>
      )}
      {canManage ? (
        <TicketInboxBulkBar
          selectedTickets={selectedTickets}
          companyById={companyById}
          contactById={contactById}
          onClear={clearBulkSelection}
          onMerged={() => clearBulkSelection()}
        />
      ) : null}
      <Sheet
        open={Boolean(selectedTicketId) && !isMobile}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewContextExpanded(false);
            onClearSelection();
          }
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            "gap-0 p-0 sm:max-w-none [&>button]:hidden",
            ticketPreviewSheetTransition,
            previewContextExpanded
              ? TICKET_PREVIEW_SHEET_EXPANDED_CLASS
              : TICKET_PREVIEW_SHEET_CLASS,
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Ticket preview</SheetTitle>
            <SheetDescription>
              Preview of the selected ticket details.
            </SheetDescription>
          </SheetHeader>
          {selectedTicketId ? (
            <TicketOverviewPreview
              ticketId={selectedTicketId}
              onClose={onClearSelection}
              onContextExpandedChange={setPreviewContextExpanded}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};
