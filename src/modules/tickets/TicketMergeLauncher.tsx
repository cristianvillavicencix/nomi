import { useMemo, useState } from "react";
import { GitMerge } from "lucide-react";
import { useGetList, type Identifier } from "ra-core";
import type { Ticket } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { TicketMergeCompareDialog } from "@/modules/tickets/TicketMergeCompareDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TicketMergeLauncher = ({
  ticket,
  onMerged,
  variant = "outline",
}: {
  ticket: Ticket;
  onMerged?: (primaryTicketId: Identifier) => void;
  variant?: "outline" | "ghost";
}) => {
  const canManage = useMemberCapability("support.tickets.manage");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState("");

  const requesterEmail = ticket.requester_email?.trim().toLowerCase() ?? "";

  const { data: relatedTickets = [] } = useGetList<Ticket>(
    "tickets",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
      filter: requesterEmail
        ? {
            "requester_email@eq": requesterEmail,
            "merged_into_ticket_id@is": null,
            "id@neq": ticket.id,
          }
        : { "id@eq": -1 },
    },
    { enabled: Boolean(requesterEmail) && canManage },
  );

  const selectedTicket = useMemo(
    () => relatedTickets.find((row) => String(row.id) === selectedTicketId),
    [relatedTickets, selectedTicketId],
  );

  if (!canManage || ticket.merged_into_ticket_id || !requesterEmail) {
    return null;
  }

  if (!relatedTickets.length) return null;

  const openCompare = () => {
    if (!selectedTicket) return;
    setPickerOpen(false);
    setCompareOpen(true);
  };

  const compareTicket =
    selectedTicket ?? (relatedTickets.length === 1 ? relatedTickets[0] : null);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className="h-9 gap-2"
        onClick={() => {
          if (relatedTickets.length === 1) {
            setSelectedTicketId(String(relatedTickets[0].id));
            setCompareOpen(true);
            return;
          }
          setSelectedTicketId(String(relatedTickets[0]?.id ?? ""));
          setPickerOpen(true);
        }}
      >
        <GitMerge className="size-4" />
        Merge
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose ticket to merge</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={selectedTicketId}
              onValueChange={setSelectedTicketId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ticket" />
              </SelectTrigger>
              <SelectContent>
                {relatedTickets.map((candidate) => (
                  <SelectItem
                    key={String(candidate.id)}
                    value={String(candidate.id)}
                  >
                    #{candidate.id} · {candidate.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedTicketId}
                onClick={openCompare}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {compareTicket ? (
        <TicketMergeCompareDialog
          open={compareOpen}
          onOpenChange={setCompareOpen}
          leftTicket={ticket}
          rightTicket={compareTicket}
          onMerged={onMerged}
        />
      ) : null}
    </>
  );
};
