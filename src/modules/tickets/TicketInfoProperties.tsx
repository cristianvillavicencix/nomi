import type { ReactNode } from "react";
import { useGetOne } from "ra-core";
import type { OrganizationMember, Ticket } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import {
  ticketPriorityClassName,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import {
  getTicketWaitingDurationLabel,
  ticketWaitingSlaClassName,
} from "@/modules/tickets/ticketSlaUtils";
import { memberDisplayName } from "@/modules/tickets/ticketInboxUi";
import { cn } from "@/lib/utils";

const PropertyRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3">
    <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
  </div>
);

export const TicketInfoProperties = ({ ticket }: { ticket: Ticket }) => {
  const assigneeId = ticket.assignee_id ?? ticket.organization_member_id;
  const { data: assignee } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: assigneeId ?? "" },
    { enabled: assigneeId != null },
  );

  const waitingLabel = getTicketWaitingDurationLabel(
    ticket.status,
    ticket.updated_at,
  );
  const waitingClass = ticketWaitingSlaClassName(
    ticket.status,
    ticket.updated_at,
  );
  const priorityLabel = ticketPriorityLabel(ticket.priority) ?? "Normal";

  return (
    <section className="min-w-0" aria-label="Ticket properties">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Properties
      </p>
      <dl className="mt-3 space-y-2.5">
        <PropertyRow label="Status">
          <Badge
            variant={ticketStatusVariant(ticket.status)}
            className="h-5 px-1.5 text-[10px] capitalize"
          >
            {ticketStatusLabel(ticket.status)}
          </Badge>
        </PropertyRow>
        <PropertyRow label="Priority">
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium capitalize",
              ticketPriorityClassName(ticket.priority) ||
                "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {priorityLabel}
          </span>
        </PropertyRow>
        <PropertyRow label="Assignee">
          <span className="font-medium">
            {assignee ? memberDisplayName(assignee) : "Unassigned"}
          </span>
        </PropertyRow>
        {waitingLabel ? (
          <PropertyRow label="SLA">
            <span
              className={cn(
                "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium",
                waitingClass,
              )}
            >
              {waitingLabel}
            </span>
          </PropertyRow>
        ) : null}
      </dl>
    </section>
  );
};
