import type { MouseEvent, ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useViewTransitionState } from "react-router";
import { SignedMemberAvatarImage } from "@/components/avatar/SignedMemberAvatarImage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
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
import { resolveTicketPrimaryContactName } from "@/modules/tickets/ticketListMeta";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
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
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";

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
  contact,
  assignee,
  invoices = [],
  lastReadAt,
  className,
  dragging,
  bulkSelected = false,
  selectionEnabled = false,
  onToggleBulkSelect,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  assignee?: OrganizationMember | null;
  invoices?: ClientInvoice[];
  lastReadAt?: string | null;
  className?: string;
  dragging?: boolean;
  bulkSelected?: boolean;
  selectionEnabled?: boolean;
  onToggleBulkSelect?: (checked: boolean) => void;
}) => {
  const stopCheckboxBubble = (event: MouseEvent) => {
    event.stopPropagation();
  };
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
  const showHref = ticketShowPath(ticket.id);
  const isTransitioning = useViewTransitionState(showHref);

  const badgeSlots: ReactNode[] = [];
  if (elevated && priorityLabel) {
    badgeSlots.push(
      <Badge
        key="priority"
        variant="outline"
        className={cn(
          "h-5 shrink-0 px-1.5 text-[10px] font-medium",
          ticketPriorityClassName(ticket.priority),
        )}
      >
        {priorityLabel}
      </Badge>,
    );
  }
  if (waitingLabel) {
    badgeSlots.push(
      <Badge
        key="waiting"
        variant="outline"
        className={cn(
          "h-5 shrink-0 px-1.5 text-[10px] font-medium",
          ticketWaitingSlaClassName(ticket.status, ticket.updated_at),
        )}
      >
        {waitingLabel}
      </Badge>,
    );
  }
  for (const invoiceBadge of getTicketInvoiceBadges(ticket, invoices)) {
    badgeSlots.push(
      <Badge
        key={invoiceBadge.key}
        variant="outline"
        className={cn(
          "h-5 shrink-0 px-1.5 text-[10px] font-medium",
          invoiceBadge.className,
        )}
      >
        {invoiceBadge.label}
      </Badge>,
    );
  }

  const companyName = company?.name?.trim() || null;
  const contactName = resolveTicketPrimaryContactName(ticket, company, contact);
  const identityParts = [companyName, contactName].filter(Boolean) as string[];
  const assigneeName = memberDisplayName(assignee) ?? "Unassigned";
  const initials = memberInitials(assignee);
  const resolved = ticket.status === "resolved";

  return (
    <div
      className={cn(
        "group",
        "relative w-full overflow-hidden rounded-lg border bg-card text-left shadow-xs transition-shadow",
        dragging && "shadow-md rotate-[0.5deg] ring-2 ring-primary/30",
        "hover:border-border/80",
        bulkSelected && "border-primary/40 bg-primary/5",
        resolved && "opacity-70",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", railClassName[rail])}
      />

      {selectionEnabled ? (
        <div
          className="absolute left-2.5 top-2 z-10"
          onClick={stopCheckboxBubble}
          onPointerDown={stopCheckboxBubble}
        >
          <Checkbox
            checked={bulkSelected}
            onCheckedChange={(value) => onToggleBulkSelect?.(value === true)}
            aria-label={`Select ticket #${ticket.id}`}
            className={cn(
              "bg-background/90 shadow-xs",
              !bulkSelected &&
                "opacity-0 transition-opacity group-hover:opacity-100",
            )}
          />
        </div>
      ) : null}

      <div
        className="absolute right-2 top-2 z-10"
        title={assigneeName}
        aria-label={assigneeName}
      >
        <Avatar className="size-7 border bg-background shadow-xs">
          {assignee ? (
            <SignedMemberAvatarImage
              member={assignee}
              size={48}
              alt={assigneeName}
            />
          ) : null}
          <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
            {initials ? (
              initials
            ) : (
              <UserRound className="size-3.5 text-muted-foreground" />
            )}
          </AvatarFallback>
        </Avatar>
      </div>

      <div
        className={cn(
          "px-3 py-2.5 pl-3.5 pr-11",
          selectionEnabled && "pl-8",
        )}
      >
        {/* Row 1: title */}
        <p
          className="line-clamp-2 text-sm font-semibold leading-snug"
          style={
            isTransitioning
              ? { viewTransitionName: `ticket-subject-${ticket.id}` }
              : undefined
          }
        >
          {formatTicketCardSubject(ticket.subject)}
        </p>

        {/* Row 2: company | primary contact */}
        {identityParts.length > 0 ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {identityParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? <TicketMetaSep /> : null}
                <span>{part}</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Unknown requester
          </p>
        )}

        {/* Row 3: #ticket | time | badges */}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            <span className="font-mono text-foreground/80">#{ticket.id}</span>
            <TicketMetaSep />
            {formatTicketListTime(ticket.updated_at)}
          </span>
          {badgeSlots.length > 0 ? (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {badgeSlots}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
