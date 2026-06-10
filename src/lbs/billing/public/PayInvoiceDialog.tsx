import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PublicInvoicePaymentFlow } from "@/lbs/billing/public/PublicInvoicePaymentFlow";
import type { PublicInvoicePayload } from "@/lbs/billing/public/publicInvoiceApi";
import { cn } from "@/lib/utils";

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
        className={cn(
          "fixed inset-0 top-auto bottom-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          "sm:inset-auto sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[min(90dvh,720px)] sm:w-[calc(100%-2rem)] sm:max-w-[560px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          "[&_[data-slot=dialog-close]]:top-[max(0.75rem,env(safe-area-inset-top))] [&_[data-slot=dialog-close]]:right-3 sm:[&_[data-slot=dialog-close]]:top-4 sm:[&_[data-slot=dialog-close]]:right-4",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pay invoice</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {open ? (
            <PublicInvoicePaymentFlow
              key={`${payload.invoice.id}-${payload.invoice.amount_paid ?? 0}`}
              token={token}
              payload={payload}
              onSuccess={handleSuccess}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
