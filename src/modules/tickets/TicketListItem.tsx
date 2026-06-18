import { Clock, Globe, Mail, Paperclip, Phone, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TicketListAssigneeControl,
  TicketListStatusControl,
} from "@/modules/tickets/TicketListCardControls";
import {
  formatTicketListMetaLine,
  getTicketListMeta,
} from "@/modules/tickets/ticketListMeta";
import { formatTicketListTime } from "@/modules/tickets/ticketInboxUi";
import { getTicketClaimLabel } from "@/modules/tickets/ticketInboxUi";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { OrganizationMember, Ticket } from "@/modules/types";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";

const MetaDot = () => (
  <span className="px-0.5 text-muted-foreground/60" aria-hidden>
    ·
  </span>
);

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
  onSelect: () => void;
  onToggleBulkSelect: (checked: boolean) => void;
  onDelete?: (ticket: Ticket) => void;
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
  onSelect,
  onToggleBulkSelect,
  onDelete,
  onUpdated,
  lastReadAt,
}: TicketListItemProps) => {
  const companyName = company?.name?.trim() || null;
  const meta = getTicketListMeta(ticket, company, contact);
  const isUnread = !selected && isTicketUnread(ticket, lastReadAt);

  const rowTwoParts = formatTicketListMetaLine([
    companyName,
    getTicketClaimLabel(ticket),
    meta.email,
    meta.phone,
    meta.website,
  ]);

  return (
    <li className="group">
      <div
        className={cn(
          "flex w-full border-b text-left transition-colors hover:bg-muted/30",
          selected
            ? "border-l-[3px] border-l-blue-600 bg-[#faf8f4]"
            : bulkSelected
              ? "border-l-[3px] border-l-primary/50 bg-primary/5"
              : isUnread
                ? "border-l-[3px] border-l-sky-500 bg-sky-50/75"
                : "border-l-[3px] border-l-transparent bg-muted/20",
        )}
      >
        <div
          className="flex items-start px-2 pt-3.5"
          onClick={(event) => event.stopPropagation()}
        >
          {selectionEnabled ? (
            <Checkbox
              checked={bulkSelected}
              onCheckedChange={(value) => onToggleBulkSelect(value === true)}
              aria-label={`Select ticket #${ticket.id}`}
            />
          ) : null}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect();
            }
          }}
          className="min-w-0 flex-1 cursor-pointer py-3 pr-2"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <TicketSubjectField
                  ticket={ticket}
                  className="min-w-0 flex-1 text-sm font-semibold leading-snug"
                  inputClassName="text-sm"
                />
                {hasAttachments ? (
                  <Paperclip
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-label="Has attachments"
                  />
                ) : null}
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {rowTwoParts.map((part, index) => (
                  <span key={`${part}-${index}`}>
                    {index > 0 ? <MetaDot /> : null}
                    <span
                      className={cn(
                        index === 1 && "font-mono text-foreground/80",
                        part === meta.email && "text-foreground/90",
                      )}
                    >
                      {part === meta.email ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Mail className="size-3 shrink-0 opacity-70" />
                          {part}
                        </span>
                      ) : part === meta.phone ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone className="size-3 shrink-0 opacity-70" />
                          {part}
                        </span>
                      ) : part === meta.website ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Globe className="size-3 shrink-0 opacity-70" />
                          <span className="truncate">{part}</span>
                        </span>
                      ) : (
                        part
                      )}
                    </span>
                  </span>
                ))}
              </p>

              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3 shrink-0 opacity-70" />
                {formatTicketListTime(ticket.updated_at)}
              </p>
            </div>

            <div
              className="flex shrink-0 items-center gap-1 pt-0.5"
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
              {canManage && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Delete ticket #${ticket.id}`}
                  onClick={() => onDelete(ticket)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};
