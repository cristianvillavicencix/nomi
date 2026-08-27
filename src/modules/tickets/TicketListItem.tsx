import { Mail, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  TicketListAssigneeControl,
  TicketListStatusControl,
} from "@/modules/tickets/TicketListCardControls";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import { TicketListInvoiceBadges } from "@/modules/tickets/TicketListInvoiceBadges";
import { ticketHasUnpaidInvoice } from "@/modules/tickets/ticketListInvoiceBadgeUtils";
import {
  isElevatedTicketPriority,
  ticketPriorityClassName,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import {
  getTicketWaitingDurationLabel,
  ticketWaitingSlaClassName,
} from "@/modules/tickets/ticketSlaUtils";
import { Badge } from "@/components/ui/badge";
import { resolveTicketPrimaryContactName } from "@/modules/tickets/ticketListMeta";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  OrganizationMember,
  Ticket,
} from "@/modules/types";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";

type TicketListItemProps = {
  ticket: Ticket;
  selected: boolean;
  bulkSelected: boolean;
  selectionEnabled?: boolean;
  canManage?: boolean;
  company?: Company | null;
  contact?: Contact | null;
  assignee?: OrganizationMember | null;
  members?: OrganizationMember[];
  hasAttachments?: boolean;
  invoices?: ClientInvoice[];
  messagePreview?: string | null;
  onSelect: () => void;
  onToggleBulkSelect: (checked: boolean) => void;
  onDelete?: (ticket: Ticket) => void;
  onEdit?: (ticket: Ticket) => void;
  onUpdated?: () => void;
  lastReadAt?: string | null;
};

export const TicketListItem = ({
  ticket,
  selected,
  bulkSelected,
  selectionEnabled = false,
  canManage = false,
  company,
  contact,
  assignee,
  members = [],
  hasAttachments = false,
  invoices = [],
  messagePreview,
  onSelect,
  onToggleBulkSelect,
  onDelete,
  onEdit,
  onUpdated,
  lastReadAt,
}: TicketListItemProps) => {
  const companyName = company?.name?.trim() || null;
  const meta = getTicketListMeta(ticket, company, contact);
  const isUnread = !selected && isTicketUnread(ticket, lastReadAt);
  const awaitingPayment = ticketHasUnpaidInvoice(ticket, invoices);
  const priorityLabel = ticketPriorityLabel(ticket.priority);
  const waitingLabel = getTicketWaitingDurationLabel(
    ticket.status,
    ticket.updated_at,
  );

  const contactName = resolveTicketPrimaryContactName(ticket, company, contact);
  const isMobile = useIsMobile();

  const identityParts = [`#${ticket.id}`, companyName, contactName].filter(
    Boolean,
  );

  const emailPreview = meta.email ?? meta.phone ?? meta.website ?? null;

  return (
    <li className="group">
      <div
        className={cn(
          "flex w-full text-left transition-colors",
          isMobile
            ? cn(
                "px-4 py-3.5 hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]",
              )
            : cn(
                "border-b hover:bg-muted/30",
                selected
                  ? "border-l-[3px] border-l-primary bg-accent dark:bg-accent/80"
                  : bulkSelected
                    ? "border-l-[3px] border-l-primary/50 bg-primary/5 dark:bg-primary/10"
                    : awaitingPayment
                      ? "border-l-[3px] border-l-warning bg-warning/10"
                      : isUnread
                        ? "border-l-[3px] border-l-info bg-info/10"
                        : "border-l-[3px] border-l-transparent bg-muted/20 dark:bg-muted/30",
              ),
        )}
      >
        {selectionEnabled ? (
          <div
            className="flex items-start px-2 pt-3.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={bulkSelected}
              onCheckedChange={(value) => onToggleBulkSelect(value === true)}
              aria-label={`Select ticket #${ticket.id}`}
            />
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "") {
              event.preventDefault();
              onSelect();
            }
          }}
          className={cn(
            "min-w-0 flex-1 cursor-pointer",
            isMobile ? "pr-1" : "py-3 pr-3",
          )}
        >
          <div className="flex min-w-0 flex-col gap-1">
            {/* Row 1: subject + time */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  {isUnread ? (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-info"
                      aria-label="Unread"
                    />
                  ) : null}
                  <TicketSubjectField
                    ticket={ticket}
                    editable={false}
                    className="min-w-0 flex-1 text-sm font-semibold leading-snug"
                  />
                  {priorityLabel && isElevatedTicketPriority(ticket) ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 h-5 shrink-0 px-1.5 text-[10px] font-medium",
                        ticketPriorityClassName(ticket.priority),
                      )}
                    >
                      {priorityLabel}
                    </Badge>
                  ) : null}
                  {waitingLabel ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 h-5 shrink-0 px-1.5 text-[10px] font-medium",
                        ticketWaitingSlaClassName(
                          ticket.status,
                          ticket.updated_at,
                        ),
                      )}
                    >
                      {waitingLabel}
                    </Badge>
                  ) : null}
                  <TicketListInvoiceBadges
                    ticket={ticket}
                    invoices={invoices}
                  />
                  {hasAttachments ? (
                    <Paperclip
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Has attachments"
                    />
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatTicketListTime(ticket.updated_at)}
              </span>
            </div>

            {/* Row 2: #ticket | company | contact */}
            {identityParts.length > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {identityParts.map((part, index) => (
                  <span key={`${part}-${index}`}>
                    {index > 0 ? <TicketMetaSep /> : null}
                    <span
                      className={
                        index === 0 ? "font-mono text-foreground/80" : undefined
                      }
                    >
                      {part}
                    </span>
                  </span>
                ))}
              </p>
            ) : null}

            {/* Row 3: message preview or contact channel */}
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  messagePreview
                    ? "text-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {messagePreview ? (
                  <span className="truncate">{messagePreview}</span>
                ) : emailPreview ? (
                  <span className="inline-flex max-w-full items-center gap-1">
                    <Mail className="size-3 shrink-0 opacity-70" />
                    <span className="truncate">{emailPreview}</span>
                  </span>
                ) : (
                  <span className="italic opacity-70">No messages yet</span>
                )}
              </p>

              <div
                className={cn(
                  "flex shrink-0 items-center gap-0.5 transition-opacity",
                  canManage && "opacity-0 group-hover:opacity-100",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <TicketListStatusControl
                  ticket={ticket}
                  canManage={canManage}
                  onUpdated={onUpdated}
                />
                <TicketListAssigneeControl
                  ticket={ticket}
                  assignee={assignee}
                  members={members}
                  canManage={canManage}
                  onUpdated={onUpdated}
                />
                {canManage && onEdit ? (
                  <IconButton
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label={`Edit ticket #${ticket.id}`}
                    onClick={() => onEdit(ticket)}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                ) : null}
                {canManage && onDelete ? (
                  <IconButton
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ticket #${ticket.id}`}
                    onClick={() => onDelete(ticket)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
