import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PublicInvoicePaymentFlow } from "@/lbs/billing/public/PublicInvoicePaymentFlow";
import type { PublicInvoicePayload } from "@/lbs/billing/public/publicInvoiceApi";

type PayInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
};

export const PayInvoiceDialog = ({
  open,
  onOpenChange,
  token,
  payload,
  onSuccess,
}: PayInvoiceDialogProps) => {
  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pay invoice</DialogTitle>
        </DialogHeader>
        {open ? (
          <PublicInvoicePaymentFlow
            key={payload.invoice.id}
            token={token}
            payload={payload}
            onSuccess={handleSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
