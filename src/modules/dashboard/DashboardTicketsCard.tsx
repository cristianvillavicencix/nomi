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
import { useTicketWorkspaceSettings } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

const ACTIVE_TICKET_FILTER = {
  "status@neq": "resolved",
  "merged_into_ticket_id@is": null,
};

export const DashboardTicketsCard = () => {
  const canViewTickets = useMemberCapability("support.tickets.view");
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: workspaceBundle } = useTicketWorkspaceSettings(canManageTickets);
  const health = workspaceBundle?.health;
  const inboundSettingsHref = `/settings?${buildSettingsSearchParams("tickets", "inbound").toString()}`;

  const { data: tickets = [], isPending } = useGetList<Ticket>(
    "tickets",
    {
      filter: ACTIVE_TICKET_FILTER,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000, enabled: canViewTickets },
  );

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

  if (!canViewTickets) return null;

  const badges = [
    ...(newCount > 0 ? [{ label: `${newCount} new` }] : []),
    ...(unreadCount > 0
      ? [{ label: `${unreadCount} unread`, tone: "danger" as const }]
      : [{ label: `${tickets.length} open` }]),
    ...(canManageTickets && health?.pipeline_stale
      ? [{ label: "Inbound stalled", tone: "danger" as const }]
      : []),
    ...(canManageTickets && (health?.inbound_failures_7d_count ?? 0) > 0
      ? [
          {
            label: `${health?.inbound_failures_7d_count} inbound issues (7d)`,
            tone: "danger" as const,
          },
        ]
      : []),
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
            {canManageTickets &&
            (health?.pipeline_stale ||
              (health?.inbound_failures_7d_count ?? 0) > 0) ? (
              <li className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
                {health?.pipeline_stale ? (
                  <p className="text-amber-950 dark:text-amber-100">
                    Inbound mail pipeline may be stalled.
                  </p>
                ) : null}
                {(health?.inbound_failures_7d_count ?? 0) > 0 ? (
                  <p className="text-amber-950 dark:text-amber-100">
                    {health?.inbound_failures_7d_count} inbound failure
                    {(health?.inbound_failures_7d_count ?? 0) === 1 ? "" : "s"}{" "}
                    in the last 7 days.
                  </p>
                ) : null}
                <Link
                  to={inboundSettingsHref}
                  className="font-medium text-primary hover:underline"
                >
                  Review inbound settings
                </Link>
              </li>
            ) : null}
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
