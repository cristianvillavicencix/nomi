import { TicketBulkMergeMultiDialog } from "@/modules/tickets/TicketBulkMergeMultiDialog";
import { TicketMergeCompareDialog } from "@/modules/tickets/TicketMergeCompareDialog";
import type { Ticket } from "@/modules/types";
import type { Identifier } from "ra-core";

export const TicketBulkMergeDialog = ({
  open,
  onOpenChange,
  tickets,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: Ticket[];
  onMerged?: (primaryTicketId: Identifier) => void;
}) => {
  if (tickets.length < 2) return null;

  if (tickets.length === 2) {
    const [leftTicket, rightTicket] = tickets;

    return (
      <TicketMergeCompareDialog
        open={open}
        onOpenChange={onOpenChange}
        leftTicket={leftTicket}
        rightTicket={rightTicket}
        onMerged={onMerged}
      />
    );
  }

  return (
    <TicketBulkMergeMultiDialog
      open={open}
      onOpenChange={onOpenChange}
      tickets={tickets}
      onMerged={onMerged}
    />
  );
};
