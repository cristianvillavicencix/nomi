import { useMemo, useState } from "react";
import { GitMerge } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const defaultPrimaryId = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const aTime = new Date(a.updated_at ?? 0).getTime();
      const bTime = new Date(b.updated_at ?? 0).getTime();
      return bTime - aTime;
    });
    return String(sorted[0]?.id ?? "");
  }, [tickets]);

  const [primaryId, setPrimaryId] = useState(defaultPrimaryId);

  const mergeMutation = useMutation({
    mutationFn: () => {
      const mergeTicketIds = tickets
        .map((ticket) => ticket.id)
        .filter((id) => String(id) !== primaryId);
      return dataProvider.mergeTickets({
        primaryTicketId: primaryId,
        mergeTicketIds,
      });
    },
    onSuccess: (result) => {
      notify(
        `Merged ${result.merged_ticket_ids.length} ticket(s) into #${result.primary_ticket_id}`,
        { type: "success" },
      );
      onOpenChange(false);
      refresh();
      onMerged?.(result.primary_ticket_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to merge tickets", { type: "error" });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPrimaryId(defaultPrimaryId);
    }
    onOpenChange(nextOpen);
  };

  if (tickets.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {tickets.length} tickets</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the primary ticket to keep. All messages from the other
            selected tickets will move into that thread.
          </p>

          <div className="space-y-2">
            <Label htmlFor="ticket-merge-primary">Primary ticket</Label>
            <Select value={primaryId} onValueChange={setPrimaryId}>
              <SelectTrigger id="ticket-merge-primary">
                <SelectValue placeholder="Select primary ticket" />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((ticket) => (
                  <SelectItem key={String(ticket.id)} value={String(ticket.id)}>
                    #{ticket.id} · {ticket.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs text-muted-foreground">
            {tickets
              .filter((ticket) => String(ticket.id) !== primaryId)
              .map((ticket) => (
                <li key={String(ticket.id)}>
                  #{ticket.id} · {ticket.subject}
                </li>
              ))}
          </ul>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mergeMutation.isPending || tickets.length < 2}
            onClick={() => mergeMutation.mutate()}
          >
            <GitMerge className="size-4" />
            Merge tickets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
