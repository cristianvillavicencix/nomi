import { useEffect, useState } from "react";
import type { Identifier } from "ra-core";
import {
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import type { Payment } from "@/components/atomic-crm/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPaymentReceiptImage } from "./uploadPaymentReceipt";

type PaymentRegisterPaidDialogProps = {
  paymentId: Identifier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra line, e.g. person name + amount when registering from a row. */
  contextHint?: string | null;
};

/**
 * Mark payment as paid with one proof image (same batch for all people on the run).
 */
export function PaymentRegisterPaidDialog({
  paymentId,
  open,
  onOpenChange,
  contextHint,
}: PaymentRegisterPaidDialogProps) {
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate<Payment>();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: payment } = useGetOne<Payment>(
    "payments",
    { id: paymentId ?? "" },
    { enabled: open && paymentId != null },
  );

  const canPay = canUseCrmPermission(identity as any, "payments.pay");

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  const handleConfirm = async () => {
    if (!payment || paymentId == null) return;
    if (!canPay) {
      notify("You do not have permission to register payments", {
        type: "error",
      });
      return;
    }
    if (payment.status === "paid") {
      notify("This payment is already registered as paid.", {
        type: "warning",
      });
      return;
    }
    if (!file) {
      notify("Add an image of the payment receipt (comprobante).", {
        type: "warning",
      });
      return;
    }
    setIsUploading(true);
    try {
      const paidReceiptUrl = await uploadPaymentReceiptImage(
        file,
        "paid",
        payment.id,
      );
      const now = new Date().toISOString();
      update(
        "payments",
        {
          id: payment.id,
          data: {
            status: "paid",
            paid_at: now,
            paid_receipt_url: paidReceiptUrl,
            ...(payment.approved_at == null ? { approved_at: now } : {}),
          },
          previousData: payment,
          meta: { identity },
        },
        {
          onSuccess: () => {
            notify("Pago aprobado y completado");
            refresh();
            onOpenChange(false);
          },
          onError: () =>
            notify("Could not register payment", { type: "error" }),
        },
      );
    } catch {
      notify("Could not upload receipt", { type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const disabled =
    !payment ||
    payment.status === "paid" ||
    !canPay ||
    isPending ||
    isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar pago</DialogTitle>
          <DialogDescription className="text-left">
            Sube <strong>una imagen del comprobante</strong> para completar el
            pago (vale para toda la corrida; incluye a todas las personas de este
            batch).
            {contextHint ? (
              <span className="mt-2 block text-foreground">{contextHint}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="payment-register-receipt">
            Comprobante de pago <span className="text-destructive">*</span>
          </Label>
          <Input
            id="payment-register-receipt"
            type="file"
            accept="image/*"
            className="cursor-pointer"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Foto o captura (transferencia, Zelle, cheque, depósito, etc.).
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={disabled || !file}
            onClick={() => void handleConfirm()}
          >
            {isUploading ? "Subiendo…" : "Aprobar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
