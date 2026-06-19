import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify, useRefresh, useUpdate } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { getTicketStatusNotePrompt } from "@/modules/tickets/ticketStatusWorkflow";
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
import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";

export type TicketStatusChangeRequest = {
  ticket: Ticket;
  nextStatus: string;
};

type TicketStatusChangeDialogProps = {
  request: TicketStatusChangeRequest | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export const TicketStatusChangeDialog = ({
  request,
  onClose,
  onSuccess,
}: TicketStatusChangeDialogProps) => {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const open = request != null;
  const fromStatus = request?.ticket.status ?? "";
  const toStatus = request?.nextStatus ?? "";

  useEffect(() => {
    if (open) setNote("");
  }, [open, request?.ticket.id, request?.nextStatus]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !pending) {
      setNote("");
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (!request) return;
    const trimmed = note.trim();
    if (!trimmed) {
      notify("Add an internal note before changing status", { type: "warning" });
      return;
    }

    setPending(true);
    try {
      await dataProvider.replyTicket({
        ticketId: request.ticket.id,
        body: `**Status:** ${fromStatus} → ${toStatus}\n\n${trimmed}`,
        isInternalNote: true,
      });
      await update(
        "tickets",
        {
          id: request.ticket.id,
          data: { status: request.nextStatus },
          previousData: request.ticket,
        },
        { mutationMode: "optimistic" },
      );
      notify("Status updated", { type: "info" });
      setNote("");
      onClose();
      onSuccess?.();
      refresh();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not update status",
        { type: "error" },
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onKeyDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Status change note</DialogTitle>
          <DialogDescription>
            {getTicketStatusNotePrompt(fromStatus, toStatus)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ticket-status-note">
            Internal note ·{" "}
            <span className="capitalize text-muted-foreground">
              {ticketStatusLabel(fromStatus)} → {ticketStatusLabel(toStatus)}
            </span>
          </Label>
          <Textarea
            id="ticket-status-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Explain what happened or what we are waiting for…"
            rows={5}
            className="min-h-[120px] resize-y"
            disabled={pending}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !note.trim()}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
