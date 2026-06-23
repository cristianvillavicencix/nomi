import { Badge } from "@/components/ui/badge";
import { getTicketInvoiceBadges } from "@/modules/tickets/ticketListInvoiceBadgeUtils";
import type { ClientInvoice, Ticket } from "@/modules/types";

type TicketListInvoiceBadgesProps = {
  ticket: Ticket;
  invoices?: ClientInvoice[];
};

export const TicketListInvoiceBadges = ({
  ticket,
  invoices = [],
}: TicketListInvoiceBadgesProps) => {
  const badges = getTicketInvoiceBadges(ticket, invoices);
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          variant="outline"
          className={`mt-0.5 shrink-0 px-1.5 py-0 text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
};
