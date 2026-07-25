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

type VoidInvoiceReasonDialogProps = {
  open: boolean;
  invoiceNumber?: string | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

export const VoidInvoiceReasonDialog = ({
  open,
  invoiceNumber,
  pending = false,
  onOpenChange,
  onConfirm,
}: VoidInvoiceReasonDialogProps) => {
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
          <DialogTitle>Why are you voiding this invoice?</DialogTitle>
          <DialogDescription>
            {invoiceNumber
              ? `Voiding ${invoiceNumber} cannot be undone. The customer will no longer be able to pay it.`
              : "Voiding this invoice cannot be undone. The customer will no longer be able to pay it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="invoice-void-reason">Reason</Label>
          <Textarea
            id="invoice-void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate invoice, client cancelled project"
            rows={3}
            className="resize-none rounded-none"
            disabled={pending}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || pending}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm(trimmed);
            }}
          >
            Void invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
