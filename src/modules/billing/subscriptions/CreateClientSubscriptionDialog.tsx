import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionFormEditor } from "@/modules/billing/subscriptions/SubscriptionFormEditor";

type CreateClientSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CreateClientSubscriptionDialog = ({
  open,
  onOpenChange,
}: CreateClientSubscriptionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,76rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[76rem]"
        onOpenAutoFocus={(event) => {
          // Keep focus on the dialog chrome — do not autofocus Client search
          // (that was opening the suggestions popover immediately).
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-invoice-item-suggestions]")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-invoice-item-suggestions]")) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-invoice-item-suggestions]")) {
            event.preventDefault();
          }
        }}
      >
        <div className="shrink-0 border-b px-8 py-5">
          <DialogHeader>
            <DialogTitle>New subscription</DialogTitle>
            <DialogDescription>
              Create a recurring plan with automatic Stripe billing.
            </DialogDescription>
          </DialogHeader>
        </div>

        {open ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SubscriptionFormEditor
              key="new-subscription"
              mode="create"
              scrollContainer="parent"
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
