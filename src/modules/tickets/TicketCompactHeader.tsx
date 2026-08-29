import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { IconButton } from "@/components/ui/icon-button";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Deal, Ticket } from "@/modules/types";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
import { resolveTicketRequesterName } from "@/modules/tickets/ticketRequester";
import { TicketSubjectField } from "@/modules/tickets/TicketSubjectField";
import { TicketListStatusControl } from "@/modules/tickets/TicketListCardControls";
import {
  isElevatedTicketPriority,
  ticketPriorityClassName,
  ticketPriorityLabel,
} from "@/modules/tickets/ticketPriorityUi";
import {
  getTicketStatusDurationLabel,
  ticketStatusDurationClassName,
} from "@/modules/tickets/ticketSlaUtils";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import {
  formatTicketWebsiteLabel,
  getTicketListMeta,
  ticketWebsiteHref,
} from "@/modules/tickets/ticketListMeta";

export const TicketCompactHeader = ({
  ticket,
  company,
  contact,
  deal,
  canManage,
  onUpdated,
  onBack,
  showBack = false,
  composeActions,
  contextAction,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
  canManage?: boolean;
  onUpdated?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  composeActions?: ReactNode;
  contextAction?: ReactNode;
}) => {
  const meta = getTicketListMeta(ticket, company, contact);
  const contactName = resolveTicketRequesterName(ticket, contact, company);
  const companyName = company?.name?.trim() || null;
  const displayPhone = meta.phone
    ? formatUsPhoneDisplayFromAny(meta.phone)
    : null;
  const website = meta.website;
  const priorityLabel = ticketPriorityLabel(ticket.priority);
  const statusDurationLabel = getTicketStatusDurationLabel(
    ticket.status,
    ticket.updated_at,
  );
  const accountPath =
    ticket.company_id != null ? getClientShowPath(ticket.company_id) : null;
  const personPath =
    contact?.id != null
      ? getPersonShowPath(contact)
      : ticket.contact_id != null
        ? getPersonShowPath({ id: ticket.contact_id, status: contact?.status })
        : null;

  return (
    <div className="shrink-0 border-b bg-background px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-start gap-2">
        {showBack && onBack ? (
          <IconButton
            className="shrink-0 lg:hidden"
            onClick={onBack}
            aria-label="Back to tickets"
          >
            <ArrowLeft className="size-4" />
          </IconButton>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <TicketListStatusControl
                ticket={ticket}
                canManage={canManage}
                onUpdated={onUpdated}
              />
            ) : (
              <Badge variant={ticketStatusVariant(ticket.status)}>
                {ticketStatusLabel(ticket.status)}
              </Badge>
            )}
            <TicketSubjectField
              key={`subject-${ticket.id}`}
              ticket={ticket}
              onUpdated={onUpdated}
              className="min-w-0 flex-1 text-base font-semibold tracking-tight"
              inputClassName="text-base font-semibold"
            />
            {priorityLabel && isElevatedTicketPriority(ticket) ? (
              <Badge
                variant="outline"
                className={ticketPriorityClassName(ticket.priority)}
              >
                {priorityLabel}
              </Badge>
            ) : null}
            {statusDurationLabel ? (
              <Badge
                variant="outline"
                className={ticketStatusDurationClassName(
                  ticket.status,
                  ticket.updated_at,
                )}
              >
                {statusDurationLabel}
              </Badge>
            ) : null}
          </div>

          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {contactName && personPath ? (
              <Link
                to={personPath}
                className="transition-colors hover:text-foreground hover:underline"
              >
                {contactName}
              </Link>
            ) : contactName ? (
              <span>{contactName}</span>
            ) : null}
            {accountPath ? (
              <>
                {contactName ? <TicketMetaSep tone="soft" /> : null}
                <Link
                  to={accountPath}
                  className="transition-colors hover:text-foreground hover:underline"
                >
                  {companyName || "Account"}
                </Link>
              </>
            ) : null}
            <TicketMetaSep tone="soft" />
            <span className="font-mono text-foreground/80">#{ticket.id}</span>
            {meta.email ? (
              <>
                <TicketMetaSep tone="soft" />
                <a
                  href={`mailto:${meta.email}`}
                  className="transition-colors hover:text-foreground hover:underline"
                >
                  {meta.email}
                </a>
              </>
            ) : null}
            {displayPhone && meta.phone ? (
              <>
                <TicketMetaSep tone="soft" />
                <CrmPhoneLink
                  phone={meta.phone}
                  contactId={contact?.id}
                  dealId={ticket.deal_id}
                  className="transition-colors hover:text-foreground hover:underline"
                />
              </>
            ) : null}
            {website ? (
              <>
                <TicketMetaSep tone="soft" />
                <a
                  href={ticketWebsiteHref(website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground hover:underline"
                >
                  {formatTicketWebsiteLabel(website)}
                </a>
              </>
            ) : null}
          </p>

          {ticket.deal_id ? (
            <p className="text-sm">
              <Link
                to={`/deals/${ticket.deal_id}/show`}
                className="font-medium text-primary hover:underline"
              >
                View deal
              </Link>
              {deal?.name ? (
                <span className="ml-1.5 text-muted-foreground">
                  ({deal.name})
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        {composeActions || contextAction ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {composeActions}
            {contextAction}
          </div>
        ) : null}
      </div>
    </div>
  );
};
