import { useEffect, useState } from "react";
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

type TicketInvoiceEditReasonDialogProps = {
  open: boolean;
  invoiceNumber?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

export const TicketInvoiceEditReasonDialog = ({
  open,
  invoiceNumber,
  onOpenChange,
  onConfirm,
}: TicketInvoiceEditReasonDialogProps) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const trimmed = reason.trim();
  const canConfirm = trimmed.length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why are you editing this invoice?</DialogTitle>
          <DialogDescription>
            {invoiceNumber
              ? `Changes apply to ${invoiceNumber}. The client keeps the same payment link.`
              : "Changes apply to this invoice. The client keeps the same payment link."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="invoice-edit-reason">Reason</Label>
          <Textarea
            id="invoice-edit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Updated line count after file review"
            rows={3}
            className="resize-none rounded-none"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm(trimmed);
              onOpenChange(false);
            }}
          >
            Continue to edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
