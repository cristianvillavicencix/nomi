import {
  DragDropContext,
  Draggable,
  Droppable,
  type OnDragEndResponder,
} from "@hello-pangea/dnd";
import { useListContext } from "ra-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { useKanbanEdgeAutoScroll } from "@/hooks/useKanbanEdgeAutoScroll";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/modules/types";
import {
  emptyTicketKanbanBuckets,
  TICKET_KANBAN_COLUMNS,
  ticketStatusForKanban,
  type TicketKanbanColumnId,
} from "@/modules/tickets/ticketOverviewConfig";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import { useTicketStatusChange } from "@/modules/tickets/useTicketStatusChange";
import {
  isElevatedTicketPriority,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";

type TicketsByStatus = Record<TicketKanbanColumnId, Ticket[]>;

const groupTicketsByStatus = (tickets: Ticket[]): TicketsByStatus => {
  const buckets = emptyTicketKanbanBuckets<Ticket>();
  for (const ticket of tickets) {
    buckets[ticketStatusForKanban(ticket.status)].push(ticket);
  }
  return buckets;
};

export const TicketsKanban = () => {
  const { data = [], isPending, refetch } = useListContext<Ticket>();
  const navigate = useNavigate();
  const [ticketsByStatus, setTicketsByStatus] = useState<TicketsByStatus>(
    emptyTicketKanbanBuckets,
  );
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(boardRef);
  useKanbanEdgeAutoScroll(boardRef, isDragging);

  const { applyStatusChange, statusChangeDialog } = useTicketStatusChange(() => {
    void refetch();
  });

  const tickets = useMemo(
    () =>
      (data ?? []).filter((ticket) => ticket.merged_into_ticket_id == null),
    [data],
  );

  useEffect(() => {
    setTicketsByStatus(groupTicketsByStatus(tickets));
  }, [tickets]);

  const onDragEnd: OnDragEndResponder = (result) => {
    setIsDragging(false);
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const fromStatus = source.droppableId as TicketKanbanColumnId;
    const toStatus = destination.droppableId as TicketKanbanColumnId;
    const ticket = ticketsByStatus[fromStatus]?.find(
      (row) => String(row.id) === draggableId,
    );
    if (!ticket) return;

    setTicketsByStatus((prev) => {
      const next = emptyTicketKanbanBuckets<Ticket>();
      for (const column of TICKET_KANBAN_COLUMNS) {
        next[column.id] = [...prev[column.id]];
      }
      const [moved] = next[fromStatus].splice(source.index, 1);
      if (!moved) return prev;
      next[toStatus].splice(destination.index, 0, {
        ...moved,
        status: toStatus,
      });
      return next;
    });

    applyStatusChange(ticket, toStatus);
  };

  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading board…
      </div>
    );
  }

  return (
    <>
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={onDragEnd}
      >
        <div
          ref={boardRef}
          className="flex h-full min-h-0 w-full gap-3 overflow-x-auto overscroll-x-contain pb-2"
        >
          {TICKET_KANBAN_COLUMNS.map((column) => {
            const columnTickets = ticketsByStatus[column.id] ?? [];
            return (
              <div
                key={column.id}
                className="flex h-full min-h-0 min-w-[14rem] max-w-[20rem] flex-1 basis-0 flex-col"
              >
                <div className="mb-2 flex shrink-0 flex-col items-center text-center">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    {column.label}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {columnTickets.length}{" "}
                    {columnTickets.length === 1 ? "ticket" : "tickets"}
                  </p>
                </div>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex min-h-[10rem] flex-1 flex-col"
                    >
                      <div
                        className={cn(
                          "flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl border bg-muted/20 p-2 transition-colors",
                          isDragging
                            ? "overflow-hidden"
                            : "overflow-y-auto overscroll-y-contain",
                          snapshot.isDraggingOver
                            ? "border-primary/50 bg-primary/5"
                            : "border-transparent",
                        )}
                      >
                        {columnTickets.map((ticket, index) => (
                          <Draggable
                            key={ticket.id}
                            draggableId={String(ticket.id)}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <button
                                type="button"
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() =>
                                  navigate(
                                    ticketShowPath(ticket.id, ticket.status),
                                  )
                                }
                                className={cn(
                                  "w-full rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs transition-shadow",
                                  dragSnapshot.isDragging && "shadow-md",
                                  "hover:border-border/80",
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                                    {ticket.subject?.trim() ||
                                      `Ticket #${ticket.id}`}
                                  </p>
                                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                    #{ticket.id}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {ticket.requester_name?.trim() ||
                                    ticket.requester_email?.trim() ||
                                    "Unknown requester"}
                                </p>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  {isElevatedTicketPriority(ticket) &&
                                  ticketPriorityLabel(ticket.priority) ? (
                                    <Badge
                                      variant="outline"
                                      className="h-5 px-1.5 text-[10px]"
                                    >
                                      {ticketPriorityLabel(ticket.priority)}
                                    </Badge>
                                  ) : (
                                    <span />
                                  )}
                                  <span className="text-[11px] tabular-nums text-muted-foreground">
                                    {formatTicketListTime(ticket.updated_at)}
                                  </span>
                                </div>
                              </button>
                            )}
                          </Draggable>
                        ))}
                        {columnTickets.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            Drop a ticket here
                          </p>
                        ) : null}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      {statusChangeDialog}
    </>
  );
};
