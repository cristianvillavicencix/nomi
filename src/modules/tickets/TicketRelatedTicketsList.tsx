import { useMemo } from "react";
import { Link } from "react-router";
import { useGetList } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientShowPath, getContactShowPath } from "@/app/routing";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/modules/types";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import { formatTicketCardSubject } from "@/modules/tickets/ticketOverviewConfig";
import { useClientScopedTickets } from "@/modules/tickets/useClientScopedTickets";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";

const RELATED_LIMIT = 6;

const statusRank = (status?: string | null) => {
  switch (status) {
    case "new":
      return 0;
    case "open":
      return 1;
    case "waiting":
      return 2;
    case "resolved":
      return 3;
    default:
      return 4;
  }
};

const sortRelatedTickets = (tickets: Ticket[]) =>
  [...tickets].sort((left, right) => {
    const byStatus = statusRank(left.status) - statusRank(right.status);
    if (byStatus !== 0) return byStatus;
    return (
      new Date(right.updated_at ?? 0).getTime() -
      new Date(left.updated_at ?? 0).getTime()
    );
  });

export const TicketRelatedTicketsList = ({
  ticket,
}: {
  ticket: Ticket;
}) => {
  const currentId = String(ticket.id);
  const companyId = ticket.company_id ?? undefined;
  const contactId = ticket.contact_id ?? undefined;
  const requesterEmail = ticket.requester_email?.trim().toLowerCase() || null;
  const scope = companyId != null ? "company" : "contact";
  const scopedEnabled = companyId != null || contactId != null;

  const { tickets: scopedTickets, isPending: scopedPending } =
    useClientScopedTickets({
      companyId,
      contactId,
      scope,
    });

  const { data: emailTickets = [], isPending: emailPending } =
    useGetList<Ticket>(
      "tickets",
      {
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
        filter: {
          "merged_into_ticket_id@is": null,
          "requester_email@eq": requesterEmail,
        },
      },
      { enabled: !scopedEnabled && Boolean(requesterEmail), staleTime: 30_000 },
    );

  const related = useMemo(() => {
    const source = scopedEnabled ? scopedTickets : emailTickets;
    return sortRelatedTickets(
      source.filter((row) => String(row.id) !== currentId),
    );
  }, [currentId, emailTickets, scopedEnabled, scopedTickets]);

  const isPending = scopedEnabled ? scopedPending : emailPending;
  const visible = related.slice(0, RELATED_LIMIT);
  const remaining = Math.max(related.length - visible.length, 0);

  const viewAllHref =
    companyId != null
      ? getClientShowPath(companyId)
      : contactId != null
        ? getContactShowPath(contactId)
        : null;

  if (!scopedEnabled && !requesterEmail) {
    return null;
  }

  return (
    <section className="mt-5 border-t border-border/60 pt-4" aria-label="Related tickets">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Related tickets
          {related.length > 0 ? (
            <span className="ml-1 font-medium tabular-nums text-foreground/70">
              ({related.length})
            </span>
          ) : null}
        </p>
        {viewAllHref && related.length > 0 ? (
          <Link
            to={viewAllHref}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>

      {isPending ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No other tickets for this client.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {visible.map((row) => (
            <li key={row.id}>
              <Link
                to={ticketShowPath(row.id, row.status)}
                className={cn(
                  "block rounded-lg border bg-card px-2.5 py-2 transition-colors",
                  "hover:border-border hover:bg-muted/40",
                  row.status === "resolved" && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {formatTicketCardSubject(row.subject)}
                  </p>
                  <Badge
                    variant={ticketStatusVariant(row.status)}
                    className="h-5 shrink-0 px-1.5 text-[10px] capitalize"
                  >
                    {ticketStatusLabel(row.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  #{row.id}
                  <span className="mx-1 text-border">·</span>
                  {formatTicketListTime(row.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {remaining === 1
            ? "1 more ticket on this client."
            : `${remaining} more tickets on this client.`}
        </p>
      ) : null}
    </section>
  );
};
