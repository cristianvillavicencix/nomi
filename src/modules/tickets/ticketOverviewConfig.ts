export type TicketsOverviewView = "table" | "kanban";

export const TICKETS_OVERVIEW_VIEW_KEY = "nomi.tickets.overviewView";

export const TICKET_KANBAN_COLUMNS = [
  { id: "new", label: "New", color: "#3b82f6" },
  { id: "open", label: "Open", color: "#0ea5e9" },
  { id: "waiting", label: "Waiting", color: "#f59e0b" },
  { id: "resolved", label: "Resolved", color: "#94a3b8" },
] as const;

export type TicketKanbanColumnId = (typeof TICKET_KANBAN_COLUMNS)[number]["id"];

export const isTicketKanbanColumnId = (
  value: string | null | undefined,
): value is TicketKanbanColumnId =>
  TICKET_KANBAN_COLUMNS.some((column) => column.id === value);

export const readPersistedTicketsOverviewView = (): TicketsOverviewView => {
  if (typeof window === "undefined") return "table";
  const stored = window.localStorage.getItem(TICKETS_OVERVIEW_VIEW_KEY);
  return stored === "kanban" ? "kanban" : "table";
};

export const ticketStatusForKanban = (
  status?: string | null,
): TicketKanbanColumnId => {
  if (isTicketKanbanColumnId(status)) return status;
  return "open";
};

export const emptyTicketKanbanBuckets = <T,>(): Record<
  TicketKanbanColumnId,
  T[]
> =>
  TICKET_KANBAN_COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = [];
      return acc;
    },
    {} as Record<TicketKanbanColumnId, T[]>,
  );
