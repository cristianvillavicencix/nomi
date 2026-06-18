import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetIdentity,
  useGetList,
  useListContext,
  useListFilterContext,
} from "ra-core";
import { useNavigate, useParams } from "react-router";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateTicketButton } from "@/modules/tickets/CreateTicketButton";
import { TicketDetailPanel } from "@/modules/tickets/TicketDetailPanel";
import {
  DEFAULT_TICKET_INBOX_EMAIL,
  TICKET_STATUS_FILTERS,
  formatTicketRelativeTime,
  ticketStatusLabel,
  ticketStatusVariant,
  type TicketStatusFilterId,
} from "@/modules/tickets/ticketInboxConfig";
import type { Ticket } from "@/modules/types";

export const TicketsInbox = () => {
  const { identity } = useGetIdentity();
  const { id } = useParams();
  const isMobile = useIsMobile();

  if (!identity) return null;

  if (isMobile && id) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TicketDetailPanel ticketId={id} />
      </div>
    );
  }

  return (
    <List
      resource="tickets"
      title={false}
      disableBreadcrumb
      perPage={50}
      sort={{ field: "updated_at", order: "DESC" }}
    >
      <TicketsInboxLayout selectedId={id ?? null} />
    </List>
  );
};

const TicketsInboxLayout = ({ selectedId }: { selectedId: string | null }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilterId>("all");
  const { filterValues, setFilters } = useListFilterContext();
  const { data: tickets = [] } = useListContext<Ticket>();

  const { data: allTickets = [] } = useGetList<Ticket>("tickets", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "updated_at", order: "DESC" },
  });

  const counts = useMemo(() => {
    const base = { all: 0, new: 0, open: 0, waiting: 0, resolved: 0 };
    for (const ticket of allTickets) {
      base.all += 1;
      const status = ticket.status as keyof typeof base;
      if (status in base && status !== "all") {
        base[status] += 1;
      }
    }
    return base;
  }, [allTickets]);

  const handleSearch = (value: string) => {
    const next = { ...filterValues };
    if (value.trim()) {
      next["subject@ilike"] = `%${value.trim()}%`;
    } else {
      delete next["subject@ilike"];
    }
    setFilters(next, {});
  };

  const handleStatusFilter = (status: TicketStatusFilterId) => {
    setStatusFilter(status);
    const next = { ...filterValues };
    if (status === "all") {
      delete next["status@eq"];
    } else {
      next["status@eq"] = status;
    }
    setFilters(next, {});
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:min-h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Tickets</h1>
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {DEFAULT_TICKET_INBOX_EMAIL}
          </Badge>
        </div>
        <div className="ml-auto">
          <CreateTicketButton />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div
          className={cn(
            "flex min-h-0 flex-col border-r",
            !isMobile && selectedId ? "hidden lg:flex" : "flex",
            isMobile && selectedId && "hidden",
          )}
        >
          <div className="space-y-3 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tickets, claims, clients..."
                className="pl-9"
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {TICKET_STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleStatusFilter(filter.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    statusFilter === filter.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  <span className="ml-1 opacity-80">{counts[filter.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!tickets.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tickets in this inbox yet.
              </p>
            ) : (
              <ul>
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/tickets/${ticket.id}/show`)}
                      className={cn(
                        "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        String(selectedId) === String(ticket.id) && "bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {ticket.company_id ? (
                              <ReferenceField
                                source="company_id"
                                reference="companies"
                                record={ticket}
                                link={false}
                              />
                            ) : (
                              ticket.requester_name ||
                              ticket.requester_email ||
                              "Unknown sender"
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {ticket.subject}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTicketRelativeTime(ticket.updated_at)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={ticketStatusVariant(ticket.status)}
                          className="h-5 capitalize"
                        >
                          {ticketStatusLabel(ticket.status)}
                        </Badge>
                        {ticket.priority === "high" ? (
                          <Badge variant="destructive" className="h-5">
                            High
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          className={cn(
            "min-h-0",
            isMobile && !selectedId && "hidden",
            !isMobile && !selectedId && "hidden lg:flex",
            "flex flex-col",
          )}
        >
          {selectedId ? (
            <TicketDetailPanel ticketId={selectedId} />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a ticket to read the thread and reply from{" "}
              {DEFAULT_TICKET_INBOX_EMAIL}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
