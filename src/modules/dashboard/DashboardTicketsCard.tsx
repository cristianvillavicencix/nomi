import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Inbox, Plus } from "lucide-react";
import { useGetList } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Ticket } from "@/modules/types";
import { DashboardModuleCard } from "@/modules/dashboard/DashboardModuleCard";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { NewTicketDialog } from "@/modules/tickets/NewTicketDialog";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";
import { useTicketInboxReads } from "@/modules/tickets/useTicketInboxReads";

const ACTIVE_TICKET_FILTER = {
  "status@neq": "resolved",
  "merged_into_ticket_id@is": null,
};

export const DashboardTicketsCard = () => {
  const canViewTickets = useMemberCapability("support.tickets.view");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: tickets = [], isPending } = useGetList<Ticket>(
    "tickets",
    {
      filter: ACTIVE_TICKET_FILTER,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000, enabled: canViewTickets },
  );

  if (!canViewTickets) return null;

  const ticketIds = useMemo(
    () => tickets.map((ticket) => String(ticket.id)),
    [tickets],
  );
  const readMap = useTicketInboxReads(ticketIds);

  const newCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "new").length,
    [tickets],
  );

  const unreadCount = useMemo(
    () =>
      tickets.filter((ticket) =>
        isTicketUnread(ticket, readMap.get(String(ticket.id))),
      ).length,
    [tickets, readMap],
  );

  const preview = useMemo(() => tickets.slice(0, 5), [tickets]);

  const badges = [
    ...(newCount > 0 ? [{ label: `${newCount} new` }] : []),
    ...(unreadCount > 0
      ? [{ label: `${unreadCount} unread`, tone: "danger" as const }]
      : [{ label: `${tickets.length} open` }]),
  ];

  return (
    <>
      <DashboardModuleCard
        icon={Inbox}
        title="Tickets"
        badges={badges}
        isPending={isPending}
        emptyMessage="No open tickets."
        viewAllHref="/tickets"
        viewAllLabel="View all tickets"
        addAction={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="p-2"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New ticket</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tickets.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((ticket) => {
              const unread = isTicketUnread(
                ticket,
                readMap.get(String(ticket.id)),
              );

              return (
                <li
                  key={String(ticket.id)}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/tickets/${ticket.id}/show`}
                      className="block truncate font-medium link-action"
                    >
                      {ticket.subject?.trim() || `Ticket #${ticket.id}`}
                    </Link>
                    {ticket.requester_name?.trim() ||
                    ticket.requester_email?.trim() ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {ticket.requester_name?.trim() ||
                          ticket.requester_email?.trim()}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      unread
                        ? "shrink-0 text-xs font-medium text-red-600"
                        : "shrink-0 text-xs text-muted-foreground"
                    }
                  >
                    {formatTicketListTime(ticket.updated_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardModuleCard>
      <NewTicketDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
