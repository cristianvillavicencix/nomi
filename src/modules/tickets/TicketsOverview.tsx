import { Inbox, KanbanSquare, List as ListIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ListContextProvider,
  useGetIdentity,
  useListContext,
} from "ra-core";
import { useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { cn } from "@/lib/utils";
import { useMarkTicketNotificationsReadOnVisit } from "@/modules/notifications/useMarkTicketNotificationsReadOnVisit";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import {
  DEFAULT_TICKET_INBOX_EMAIL,
  TICKET_STATUS_FILTERS,
  type TicketStatusFilterId,
} from "@/modules/tickets/ticketInboxConfig";
import {
  readPersistedTicketsOverviewView,
  TICKETS_OVERVIEW_VIEW_KEY,
  type TicketsOverviewView,
} from "@/modules/tickets/ticketOverviewConfig";
import {
  buildTicketInboxStatusFilter,
  isTicketStatusFilterId,
} from "@/modules/tickets/ticketStatusWorkflow";
import { TicketsKanban } from "@/modules/tickets/TicketsKanban";
import { TicketsOverviewTable } from "@/modules/tickets/TicketsOverviewTable";
import { useTicketsInboxRealtime } from "@/modules/tickets/useTicketsInboxRealtime";
import type { Ticket } from "@/modules/types";

export const TicketsOverview = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const statusFilter: TicketStatusFilterId = isTicketStatusFilterId(statusParam)
    ? statusParam
    : "all";
  const [view, setView] = useState<TicketsOverviewView>(() =>
    readPersistedTicketsOverviewView(),
  );
  const [searchQuery, setSearchQuery] = useState("");

  useTicketsInboxRealtime(Boolean(identity));
  useMarkTicketNotificationsReadOnVisit();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TICKETS_OVERVIEW_VIEW_KEY, view);
  }, [view]);

  const listFilter = useMemo(
    () => ({
      "merged_into_ticket_id@is": null,
      ...buildTicketInboxStatusFilter(statusFilter),
    }),
    [statusFilter],
  );

  if (!identity) return null;

  return (
    <List
      resource="tickets"
      title={false}
      disableBreadcrumb
      contentScrollable={view === "table"}
      pagination={view === "table" ? undefined : false}
      perPage={view === "kanban" ? 200 : 50}
      sort={{ field: "updated_at", order: "DESC" }}
      filter={listFilter}
      disableSyncWithLocation
      storeKey={`tickets.overview.${statusFilter}.${view}`}
      queryOptions={{ refetchInterval: 30_000 }}
      className={view === "kanban" ? "mt-0 min-h-0 flex-1" : undefined}
      actions={
        <TicketsOverviewActions
          view={view}
          onViewChange={setView}
          statusFilter={statusFilter}
          onStatusFilterChange={(next) => {
            const params = new URLSearchParams(searchParams);
            if (next === "all") params.delete("status");
            else params.set("status", next);
            setSearchParams(params, { replace: true });
          }}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      }
    >
      <TicketsOverviewBody view={view} searchQuery={searchQuery} />
    </List>
  );
};

const TicketsOverviewActions = ({
  view,
  onViewChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
}: {
  view: TicketsOverviewView;
  onViewChange: (view: TicketsOverviewView) => void;
  statusFilter: TicketStatusFilterId;
  onStatusFilterChange: (status: TicketStatusFilterId) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) => {
  const { total } = useListContext<Ticket>();

  return (
    <PageActions>
      <Inbox className="size-4 shrink-0 text-muted-foreground" />
      <PageTitle label="Tickets" count={total ?? null} />
      <Badge variant="outline" className="font-mono text-xs font-normal">
        {DEFAULT_TICKET_INBOX_EMAIL}
      </Badge>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (value === "table" || value === "kanban") onViewChange(value);
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="table" aria-label="Table view">
          <ListIcon className="size-4" />
          Table
        </ToggleGroupItem>
        <ToggleGroupItem value="kanban" aria-label="Kanban view">
          <KanbanSquare className="size-4" />
          Kanban
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="relative min-w-[160px] max-w-xs flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search tickets…"
          className="h-8 pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {TICKET_STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onStatusFilterChange(filter.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === filter.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="ml-auto">
        <CreateTicketButton />
      </div>
    </PageActions>
  );
};

const TicketsOverviewBody = ({
  view,
  searchQuery,
}: {
  view: TicketsOverviewView;
  searchQuery: string;
}) => {
  const list = useListContext<Ticket>();
  const trimmed = searchQuery.trim().toLowerCase();

  const filteredData = useMemo(() => {
    const rows = list.data ?? [];
    if (!trimmed) return rows;
    return rows.filter((ticket) => {
      const haystack = [
        ticket.subject,
        ticket.requester_name,
        ticket.requester_email,
        String(ticket.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [list.data, trimmed]);

  const content =
    view === "kanban" ? <TicketsKanban /> : <TicketsOverviewTable />;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col px-1 pt-1",
        view === "kanban" ? "pb-2" : "pb-3",
      )}
    >
      {trimmed ? (
        <FilteredListContext data={filteredData}>{content}</FilteredListContext>
      ) : (
        content
      )}
    </div>
  );
};

const FilteredListContext = ({
  data,
  children,
}: {
  data: Ticket[];
  children: ReactNode;
}) => {
  const parent = useListContext<Ticket>();
  return (
    <ListContextProvider
      value={{
        ...parent,
        data,
        total: data.length,
      }}
    >
      {children}
    </ListContextProvider>
  );
};
