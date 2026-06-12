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
import { PublicInvoicePaymentFlow } from "@/modules/billing/public/PublicInvoicePaymentFlow";
import type { PublicInvoicePayload } from "@/modules/billing/public/publicInvoiceApi";
import { useIsBelowLg } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type PayInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
};

const stopDrawerPointerCapture = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

const PayInvoiceFlowBody = ({
  open,
  token,
  payload,
  onSuccess,
  sheetLayout = false,
}: {
  open: boolean;
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
  sheetLayout?: boolean;
}) =>
  open ? (
    <PublicInvoicePaymentFlow
      key={`${payload.invoice.id}-${payload.invoice.amount_paid ?? 0}`}
      token={token}
      payload={payload}
      onSuccess={onSuccess}
      sheetLayout={sheetLayout}
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
        handleOnly
        repositionInputs={false}
        shouldScaleBackground
      >
        <DrawerContent
          className={cn(
            "mt-0 flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0",
          )}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Pay invoice</DrawerTitle>
          </DrawerHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag
            onPointerDownCapture={stopDrawerPointerCapture}
          >
            <PayInvoiceFlowBody
              open={open}
              token={token}
              payload={payload}
              onSuccess={handleSuccess}
              sheetLayout
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
