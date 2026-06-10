import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { PublicInvoicePaymentFlow } from "@/lbs/billing/public/PublicInvoicePaymentFlow";
import type { PublicInvoicePayload } from "@/lbs/billing/public/publicInvoiceApi";
import { useIsBelowLg } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type PayInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
};

const PayInvoiceFlowBody = ({
  open,
  token,
  payload,
  onSuccess,
}: {
  open: boolean;
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
}) =>
  open ? (
    <PublicInvoicePaymentFlow
      key={`${payload.invoice.id}-${payload.invoice.amount_paid ?? 0}`}
      token={token}
      payload={payload}
      onSuccess={onSuccess}
    />
  ) : null;

export const PayInvoiceDialog = ({
  open,
  onOpenChange,
  token,
  payload,
  onSuccess,
}: PayInvoiceDialogProps) => {
  const isCompact = useIsBelowLg();

  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess();
  };

  if (isCompact) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        shouldScaleBackground
      >
        <DrawerContent
          className={cn(
            "max-h-[92dvh] gap-0 rounded-t-2xl border-t p-0",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Pay invoice</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag
          >
            <PayInvoiceFlowBody
              open={open}
              token={token}
              payload={payload}
              onSuccess={handleSuccess}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-[560px] flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pay invoice</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PayInvoiceFlowBody
            open={open}
            token={token}
            payload={payload}
            onSuccess={handleSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
