import { Inbox, KanbanSquare, List as ListIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
import { useNavigate, useSearchParams } from "react-router";
import { List } from "@/components/admin/list";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useMarkTicketNotificationsReadOnVisit } from "@/modules/notifications/useMarkTicketNotificationsReadOnVisit";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
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
      actions={
        <TicketsOverviewActions view={view} onViewChange={setView} />
      }
    >
      <TicketsOverviewBody
        view={view}
        selectedTicketId={selectedTicketId}
        onSelectTicket={handleSelectTicket}
        onClearSelection={() => setSelectedTicketId(null)}
        isMobile={isMobile}
      />
    </List>
  );
};

const TicketsOverviewActions = ({
  view,
  onViewChange,
}: {
  view: TicketsOverviewView;
  onViewChange: (view: TicketsOverviewView) => void;
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
      <div className="ml-auto">
        <CreateTicketButton />
      </div>
    </PageActions>
  );
};

const TicketsOverviewBody = ({
  view,
  selectedTicketId,
  onSelectTicket,
  onClearSelection,
  isMobile,
}: {
  view: TicketsOverviewView;
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  onClearSelection: () => void;
  isMobile: boolean;
}) => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col px-1 pt-1",
      view === "kanban" ? "pb-2" : "pb-3",
    )}
  >
    {view === "table" ? (
      <TicketsOverviewTableLayout
        selectedTicketId={selectedTicketId}
        onSelectTicket={onSelectTicket}
        onClearSelection={onClearSelection}
        isMobile={isMobile}
      />
    ) : (
      <>
        <TicketsKanban
          selectedTicketId={selectedTicketId}
          onSelectTicket={onSelectTicket}
        />
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
            </SheetHeader>
            {selectedTicketId ? (
              <TicketOverviewPreview
                ticketId={selectedTicketId}
                onClose={onClearSelection}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      </>
    )}
  </div>
);

const TicketsOverviewTableLayout = ({
  selectedTicketId,
  onSelectTicket,
  onClearSelection,
  isMobile,
}: {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  onClearSelection: () => void;
  isMobile: boolean;
}) => {
  const showPreview = Boolean(selectedTicketId) && !isMobile;

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 gap-2",
        showPreview
          ? "grid-cols-1 md:grid-cols-[minmax(18rem,40%)_minmax(0,1fr)]"
          : "grid-cols-1",
      )}
    >
      <TicketsOverviewTable
        selectedTicketId={selectedTicketId}
        onSelectTicket={onSelectTicket}
      />
      {showPreview && selectedTicketId ? (
        <div className="min-h-0 overflow-hidden rounded-xl border">
          <TicketOverviewPreview
            ticketId={selectedTicketId}
            onClose={onClearSelection}
          />
        </div>
      ) : null}
    </div>
  );
};
