import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useNotify, useRefresh, useUpdate } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TicketBulkResolveDialogProps = {
  open: boolean;
  tickets: Ticket[];
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
};

export const TicketBulkResolveDialog = ({
  open,
  tickets,
  onOpenChange,
  onResolved,
}: TicketBulkResolveDialogProps) => {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const handleConfirm = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      notify("Add an internal note before resolving tickets", {
        type: "warning",
      });
      return;
    }

    setPending(true);
    try {
      for (const ticket of tickets) {
        await dataProvider.replyTicket({
          ticketId: ticket.id,
          body: trimmed,
          isInternalNote: true,
        });
        await update(
          "tickets",
          {
            id: ticket.id,
            data: { status: "resolved" },
            previousData: ticket,
          },
          { mutationMode: "optimistic" },
        );
      }
      notify(`Marked ${tickets.length} ticket(s) as resolved`, {
        type: "success",
      });
      setNote("");
      onOpenChange(false);
      onResolved();
      refresh();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not resolve tickets",
        { type: "error" },
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve {tickets.length} ticket(s)?</DialogTitle>
          <DialogDescription>
            Add an internal note explaining why these tickets are resolved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-resolve-note">Internal note</Label>
          <Textarea
            id="bulk-resolve-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What was done or why are these closed?"
            rows={4}
            disabled={pending}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !note.trim()}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
