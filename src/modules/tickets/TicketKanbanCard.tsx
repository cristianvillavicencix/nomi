import type { MouseEvent } from "react";
import { Flag, Hourglass, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useViewTransitionState } from "react-router";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  OrganizationMember,
  Ticket,
} from "@/modules/types";
import { TicketListAssigneeControl } from "@/modules/tickets/TicketListCardControls";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import {
  getTicketInvoiceBadges,
  ticketHasUnpaidInvoice,
} from "@/modules/tickets/ticketListInvoiceBadgeUtils";
import { resolveTicketPrimaryContactName } from "@/modules/tickets/ticketListMeta";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
import { resolveTicketKanbanRibbon } from "@/modules/tickets/ticketKanbanCardMeta";
import { TicketServiceTypeChips } from "@/modules/tickets/TicketServiceTypeChips";
import {
  formatTicketCardSubject,
  resolveTicketCardRailTone,
} from "@/modules/tickets/ticketOverviewConfig";
import {
  isElevatedTicketPriority,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";
import { getTicketWaitingDurationLabel } from "@/modules/tickets/ticketSlaUtils";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";

/** Kanban board ticket card (classification via TicketServiceTypeChips). */
const railClassName: Record<
  ReturnType<typeof resolveTicketCardRailTone>,
  string
> = {
  unpaid: "bg-warning",
  unread: "bg-info",
  priority: "bg-orange-500",
  default: "bg-border",
};

const MetaIcon = ({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Flag;
  label: string;
  className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center",
          className,
        )}
        aria-label={label}
      >
        <Icon className="size-3" strokeWidth={2} aria-hidden />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">{label}</TooltipContent>
  </Tooltip>
);

export const TicketKanbanCard = ({
  ticket,
  company,
  contact,
  assignee,
  members = [],
  invoices = [],
  lastReadAt,
  className,
  dragging,
  bulkSelected = false,
  selectionEnabled = false,
  canManage = false,
  onToggleBulkSelect,
  onEdit,
  onDelete,
  onUpdated,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  assignee?: OrganizationMember | null;
  members?: OrganizationMember[];
  invoices?: ClientInvoice[];
  lastReadAt?: string | null;
  className?: string;
  dragging?: boolean;
  bulkSelected?: boolean;
  selectionEnabled?: boolean;
  canManage?: boolean;
  onToggleBulkSelect?: (checked: boolean) => void;
  onEdit?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
  onUpdated?: () => void;
}) => {
  const stopActionBubble = (event: MouseEvent) => {
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

  const invoiceSignal = getTicketInvoiceBadges(ticket, invoices)[0] ?? null;
  const ribbon = resolveTicketKanbanRibbon(invoiceSignal);

  const companyName = company?.name?.trim() || null;
  const contactName = resolveTicketPrimaryContactName(ticket, company, contact);
  const identityParts = [companyName, contactName].filter(Boolean) as string[];
  const resolved = ticket.status === "resolved";
  const showManageMenu = canManage && (onEdit || onDelete);

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

      {ribbon ? (
        <div
          className="pointer-events-none absolute bottom-0 right-0 z-[1] size-14 overflow-hidden rounded-br-lg"
          aria-label={ribbon.label}
        >
          <span
            className={cn(
              "absolute bottom-[0.85rem] -right-6 w-[5.75rem] -rotate-45 py-px text-center text-[8px] font-bold uppercase tracking-wider shadow-sm",
              ribbon.className,
            )}
          >
            {ribbon.label}
          </span>
        </div>
      ) : null}

      {/* Top-right: avatar (swaps with select checkbox); ⋯ below avatar */}
      <div
        className="absolute right-1.5 top-1.5 z-10 flex flex-col items-center gap-0.5"
        onClick={stopActionBubble}
        onPointerDown={stopActionBubble}
      >
        <div className="relative size-7">
          {selectionEnabled ? (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity",
                bulkSelected
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              <Checkbox
                checked={bulkSelected}
                onCheckedChange={(value) =>
                  onToggleBulkSelect?.(value === true)
                }
                aria-label={`Select ticket #${ticket.id}`}
                className="bg-background shadow-xs"
              />
            </div>
          ) : null}
          <div
            className={cn(
              "absolute inset-0 transition-opacity",
              selectionEnabled &&
                (bulkSelected
                  ? "pointer-events-none opacity-0"
                  : "group-hover:pointer-events-none group-hover:opacity-0"),
            )}
          >
            <TicketListAssigneeControl
              ticket={ticket}
              assignee={assignee}
              members={members}
              canManage={canManage}
              onUpdated={onUpdated}
            />
          </div>
        </div>

        {showManageMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                className={cn(
                  "size-6 text-muted-foreground hover:text-foreground",
                  "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100",
                )}
                aria-label={`Ticket #${ticket.id} actions`}
              >
                <MoreHorizontal className="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40"
              onClick={stopActionBubble}
            >
              {onEdit ? (
                <DropdownMenuItem onSelect={() => onEdit(ticket)}>
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(ticket)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="relative z-[2] px-3 py-2.5 pl-3.5 pr-11">
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

        {/* #ticket · time · clickable type chips · priority */}
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            <span className="font-mono text-foreground/80">#{ticket.id}</span>
            <TicketMetaSep />
            {formatTicketListTime(ticket.updated_at)}
          </span>
          <TicketServiceTypeChips
            ticket={ticket}
            canManage={canManage}
            onUpdated={onUpdated}
          />
          {(elevated && priorityLabel) || waitingLabel ? (
            <TooltipProvider delayDuration={200}>
              <span className="inline-flex items-center gap-0.5">
                {elevated && priorityLabel ? (
                  <MetaIcon
                    icon={Flag}
                    label={priorityLabel}
                    className="text-orange-500 dark:text-orange-400"
                  />
                ) : null}
                {waitingLabel ? (
                  <MetaIcon
                    icon={Hourglass}
                    label={waitingLabel}
                    className="text-amber-600 dark:text-amber-400"
                  />
                ) : null}
              </span>
            </TooltipProvider>
          ) : null}
        </div>
      </div>
    </div>
  );
};
