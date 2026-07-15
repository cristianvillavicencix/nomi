import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Company } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  OrganizationMember,
  Ticket,
} from "@/modules/types";
import {
  formatTicketListTime,
  memberDisplayName,
} from "@/modules/tickets/ticketInboxUi";
import {
  getTicketInvoiceBadges,
  ticketHasUnpaidInvoice,
} from "@/modules/tickets/ticketListInvoiceBadgeUtils";
import {
  formatTicketCardSubject,
  resolveTicketCardRailTone,
} from "@/modules/tickets/ticketOverviewConfig";
import {
  isElevatedTicketPriority,
  ticketPriorityClassName,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";
import {
  getTicketWaitingDurationLabel,
  ticketWaitingSlaClassName,
} from "@/modules/tickets/ticketSlaUtils";

const railClassName: Record<
  ReturnType<typeof resolveTicketCardRailTone>,
  string
> = {
  unpaid: "bg-warning",
  unread: "bg-info",
  priority: "bg-orange-500",
  default: "bg-border",
};

const memberInitials = (member?: OrganizationMember | null) => {
  const label = memberDisplayName(member);
  if (!label) return null;
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
};

export const TicketKanbanCard = ({
  ticket,
  company,
  assignee,
  invoices = [],
  lastReadAt,
  className,
  dragging,
}: {
  ticket: Ticket;
  company?: Company | null;
  assignee?: OrganizationMember | null;
  invoices?: ClientInvoice[];
  lastReadAt?: string | null;
  className?: string;
  dragging?: boolean;
}) => {
  const unpaid = ticketHasUnpaidInvoice(ticket, invoices);
  const unread = isTicketUnread(ticket, lastReadAt);
  const elevated = isElevatedTicketPriority(ticket);
  const rail = resolveTicketCardRailTone({
    unpaid,
    unread,
    elevatedPriority: elevated,
  });
  const priorityLabel = ticketPriorityLabel(ticket.priority);
  const waitingLabel = getTicketWaitingDurationLabel(
    ticket.status,
    ticket.updated_at,
  );

  const badgeSlots: ReactNode[] = [];
  if (elevated && priorityLabel) {
    badgeSlots.push(
      <Badge
        key="priority"
        variant="outline"
        className={cn(
          "h-5 px-1.5 text-[10px] font-medium",
          ticketPriorityClassName(ticket.priority),
        )}
      >
        {priorityLabel}
      </Badge>,
    );
  }
  if (waitingLabel && badgeSlots.length < 3) {
    badgeSlots.push(
      <Badge
        key="waiting"
        variant="outline"
        className={cn(
          "h-5 px-1.5 text-[10px] font-medium",
          ticketWaitingSlaClassName(ticket.status, ticket.updated_at),
        )}
      >
        {waitingLabel}
      </Badge>,
    );
  }
  const invoiceBadge = getTicketInvoiceBadges(ticket, invoices)[0];
  if (invoiceBadge && badgeSlots.length < 3) {
    badgeSlots.push(
      <Badge
        key={invoiceBadge.key}
        variant="outline"
        className={cn(
          "h-5 px-1.5 text-[10px] font-medium",
          invoiceBadge.className,
        )}
      >
        {invoiceBadge.label}
      </Badge>,
    );
  }

  const clientLabel =
    company?.name?.trim() ||
    ticket.requester_name?.trim() ||
    ticket.requester_email?.trim() ||
    "Unknown requester";
  const initials = memberInitials(assignee);
  const resolved = ticket.status === "resolved";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-card text-left shadow-xs transition-shadow",
        dragging && "shadow-md",
        "hover:border-border/80",
        resolved && "opacity-70",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", railClassName[rail])}
      />
      <div className="px-3 py-2.5 pl-3.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {formatTicketCardSubject(ticket.subject)}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {clientLabel}
        </p>
        {badgeSlots.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {badgeSlots}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            #{ticket.id}
            <span className="mx-1 text-border">·</span>
            {formatTicketListTime(ticket.updated_at)}
          </span>
          {initials ? (
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
              title={memberDisplayName(assignee) ?? "Assignee"}
            >
              {initials}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/80">
              Unassigned
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
