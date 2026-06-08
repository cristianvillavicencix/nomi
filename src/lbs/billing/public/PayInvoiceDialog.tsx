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
      <DialogContent
        showCloseButton
        className="fixed inset-x-0 bottom-0 top-auto h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-transparent p-0 shadow-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-auto sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-[560px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pay invoice</DialogTitle>
        </DialogHeader>
        {open ? (
          <PublicInvoicePaymentFlow
            key={`${payload.invoice.id}-${payload.invoice.amount_paid ?? 0}`}
            token={token}
            payload={payload}
            onSuccess={handleSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
