import { Inbox, KanbanSquare, List as ListIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useMarkTicketNotificationsReadOnVisit } from "@/modules/notifications/useMarkTicketNotificationsReadOnVisit";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import {
  readPersistedTicketsOverviewView,
  TICKETS_OVERVIEW_VIEW_KEY,
  type TicketsOverviewView,
} from "@/modules/tickets/ticketOverviewConfig";
import { TicketOverviewPreview } from "@/modules/tickets/TicketOverviewPreview";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import { TicketsKanban } from "@/modules/tickets/TicketsKanban";
import { TicketsOverviewTable } from "@/modules/tickets/TicketsOverviewTable";
import { useTicketsInboxRealtime } from "@/modules/tickets/useTicketsInboxRealtime";
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
      contentScrollable={view === "table"}
      pagination={view === "table" ? undefined : false}
      perPage={view === "kanban" ? 200 : 50}
      sort={{ field: "updated_at", order: "DESC" }}
      filter={OVERVIEW_LIST_FILTER}
      disableSyncWithLocation
      storeKey={`tickets.overview.${view}`}
      queryOptions={{ refetchInterval: 30_000 }}
      className={view === "kanban" ? "mt-0 min-h-0 flex-1" : undefined}
      actions={<TicketsOverviewActions />}
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
  const { total } = useListContext<Ticket>();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3",
        view === "kanban" ? "pb-2" : "pb-3",
      )}
    >
      <ModuleToolbar>
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
        <TicketsOverviewTable
          selectedTicketId={selectedTicketId}
          onSelectTicket={onSelectTicket}
          searchQuery={searchQuery}
        />
      ) : (
        <TicketsKanban
          selectedTicketId={selectedTicketId}
          onSelectTicket={onSelectTicket}
          searchQuery={searchQuery}
        />
      )}
      <Sheet
        open={Boolean(selectedTicketId) && !isMobile}
        onOpenChange={(open) => {
          if (!open) onClearSelection();
        }}
      >
        <SheetContent
          side="right"
          className="w-[min(55vw,44rem)] gap-0 p-0 sm:max-w-none [&>button]:hidden"
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
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};
