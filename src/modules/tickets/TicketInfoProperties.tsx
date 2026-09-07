import type { ReactNode } from "react";
import { useGetOne } from "ra-core";
import { StatusPill } from "@/modules/shared/status";
import type { OrganizationMember, Ticket } from "@/modules/types";
import {
  ticketStatusLabel,
  ticketStatusTone,
} from "@/modules/tickets/ticketInboxConfig";
import {
  ticketPriorityClassName,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import {
  getTicketStatusDurationLabel,
  ticketStatusDurationClassName,
} from "@/modules/tickets/ticketSlaUtils";
import { memberDisplayName } from "@/modules/tickets/ticketInboxUi";
import { cn } from "@/lib/utils";

const PropertyChip = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="min-w-0 rounded-lg border bg-muted/15 px-2.5 py-2">
    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <div className="mt-1 min-w-0 text-sm text-foreground">{children}</div>
  </div>
);

export const TicketInfoProperties = ({ ticket }: { ticket: Ticket }) => {
  const assigneeId = ticket.assignee_id ?? ticket.organization_member_id;
  const { data: assignee } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: assigneeId ?? "" },
    { enabled: assigneeId != null },
  );

  const statusDurationLabel = getTicketStatusDurationLabel(
    ticket.status,
    ticket.updated_at,
  );
  const statusDurationClass = ticketStatusDurationClassName(
    ticket.status,
    ticket.updated_at,
  );
  const priorityLabel = ticketPriorityLabel(ticket.priority) ?? "Normal";

  return (
    <section className="min-w-0" aria-label="Ticket properties">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Properties
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <PropertyChip label="Status">
          <StatusPill
            tone={ticketStatusTone(ticket.status)}
            className="h-5 px-1.5 text-[10px] capitalize"
          >
            {ticketStatusLabel(ticket.status)}
          </StatusPill>
        </PropertyChip>
        <PropertyChip label="Priority">
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium capitalize",
              ticketPriorityClassName(ticket.priority) ||
                "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {priorityLabel}
          </span>
        </PropertyChip>
        {statusDurationLabel ? (
          <PropertyChip label="In status">
            <span
              className={cn(
                "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium",
                statusDurationClass,
              )}
            >
              {statusDurationLabel}
            </span>
          </PropertyChip>
        ) : null}
        <PropertyChip label="Assignee">
          <span className="block truncate font-medium">
            {assignee ? memberDisplayName(assignee) : "Unassigned"}
          </span>
        </PropertyChip>
      </div>
    </section>
  );
};
