import {
  DragDropContext,
  Draggable,
  Droppable,
  type OnDragEndResponder,
} from "@hello-pangea/dnd";
import { useGetList, useListContext } from "ra-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { useKanbanEdgeAutoScroll } from "@/hooks/useKanbanEdgeAutoScroll";
import { cn } from "@/lib/utils";
import type { Company } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  OrganizationMember,
  Ticket,
} from "@/modules/types";
import { TicketKanbanCard } from "@/modules/tickets/TicketKanbanCard";
import {
  emptyTicketKanbanBuckets,
  TICKET_KANBAN_COLUMNS,
  ticketStatusForKanban,
  type TicketKanbanColumnId,
} from "@/modules/tickets/ticketOverviewConfig";
import { matchesTicketSearch } from "@/modules/tickets/ticketInboxQueue";
import { useTicketInboxReads } from "@/modules/tickets/useTicketInboxReads";
import { useTicketStatusChange } from "@/modules/tickets/useTicketStatusChange";

type TicketsByStatus = Record<TicketKanbanColumnId, Ticket[]>;

const groupTicketsByStatus = (tickets: Ticket[]): TicketsByStatus => {
  const buckets = emptyTicketKanbanBuckets<Ticket>();
  for (const ticket of tickets) {
    buckets[ticketStatusForKanban(ticket.status)].push(ticket);
  }
  return buckets;
};

/** Stable signature so unstable list array refs don't retrigger sync. */
const ticketsKanbanSyncKey = (tickets: Ticket[]) =>
  tickets
    .map(
      (ticket) =>
        `${ticket.id}:${ticketStatusForKanban(ticket.status)}:${ticket.updated_at ?? ""}`,
    )
    .sort()
    .join("| ");

const isSameTicketsByStatus = (a: TicketsByStatus, b: TicketsByStatus) => {
  for (const column of TICKET_KANBAN_COLUMNS) {
    const left = a[column.id];
    const right = b[column.id];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (String(left[i]?.id) !== String(right[i]?.id)) return false;
      if (ticketStatusForKanban(left[i]?.status) !== ticketStatusForKanban(right[i]?.status)) {
        return false;
      }
    }
  }
  return true;
};

export const TicketsKanban = ({
  selectedTicketId,
  onSelectTicket,
  searchQuery = "",
}: {
  selectedTicketId?: string | null;
  onSelectTicket: (ticketId: string) => void;
  searchQuery?: string;
}) => {
  const { data = [], isPending, refetch } = useListContext<Ticket>();
  const [ticketsByStatus, setTicketsByStatus] = useState<TicketsByStatus>(
    emptyTicketKanbanBuckets,
  );
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(boardRef);
  useKanbanEdgeAutoScroll(boardRef, isDragging);

  const { applyStatusChange, statusChangeDialog } = useTicketStatusChange(() => {
    void refetch();
  });

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
  const assigneeIds = useMemo(
    () =>
      [
        ...new Set(
          allTickets
            .map(
              (ticket) =>
                ticket.assignee_id ?? ticket.organization_member_id ?? null,
            )
            .filter((id): id is number => id != null)
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
    if (!trimmed) return allTickets;
    return allTickets.filter((ticket) => {
      const company =
        ticket.company_id != null
          ? companiesById.get(Number(ticket.company_id))
          : null;
      return matchesTicketSearch(ticket, trimmed, {
        email: company?.primary_contact_email_jsonb?.find((entry) =>
          entry.email?.trim(),
        )?.email,
        phone: company?.phone_number,
        contactName: company?.name,
      });
    });
  }, [allTickets, companiesById, searchQuery]);

  const syncKey = useMemo(() => ticketsKanbanSyncKey(tickets), [tickets]);

  useEffect(() => {
    const next = groupTicketsByStatus(tickets);
    setTicketsByStatus((prev) =>
      isSameTicketsByStatus(prev, next) ? prev : next,
    );
    // syncKey captures id/status/updated_at; tickets is read for fresh grouping.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid loops from unstable `data` refs
  }, [syncKey]);

  const onDragEnd: OnDragEndResponder = (result) => {
    setIsDragging(false);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

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
                        {columnTickets.map((ticket, index) => {
                          const ticketId = String(ticket.id);
                          const assigneeId =
                            ticket.assignee_id ??
                            ticket.organization_member_id ??
                            null;
                          const selected = selectedTicketId === ticketId;
                          return (
                            <Draggable
                              key={ticket.id}
                              draggableId={ticketId}
                              index={index}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <button
                                  type="button"
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  onClick={() => {
                                    if (suppressClickRef.current) return;
                                    onSelectTicket(ticketId);
                                  }}
                                  className={cn(
                                    "w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    selected && "ring-2 ring-primary/40",
                                  )}
                                >
                                  <TicketKanbanCard
                                    ticket={ticket}
                                    company={
                                      ticket.company_id != null
                                        ? companiesById.get(
                                            Number(ticket.company_id),
                                          )
                                        : null
                                    }
                                    assignee={
                                      assigneeId != null
                                        ? membersById.get(Number(assigneeId))
                                        : null
                                    }
                                    invoices={
                                      invoicesByTicketId.get(ticketId) ?? []
                                    }
                                    lastReadAt={readMap.get(ticketId) ?? null}
                                    dragging={dragSnapshot.isDragging}
                                  />
                                </button>
                              )}
                            </Draggable>
                          );
                        })}
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
