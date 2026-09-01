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
  /** Pre-select agreement enrollment and contract template (e.g. from Templates → Send). */
  initialContractTermsId?: number | null;
  initialPackageId?: number | null;
  initialEnrollmentMode?: "agreement" | "direct";
};

export const CreateClientSubscriptionDialog = ({
  open,
  onOpenChange,
  initialContractTermsId = null,
  initialPackageId = null,
  initialEnrollmentMode = "direct",
}: CreateClientSubscriptionDialogProps) => {
  const editorKey = [
    initialContractTermsId ?? "none",
    initialPackageId ?? "none",
    initialEnrollmentMode,
  ].join("-");
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
              {initialEnrollmentMode === "agreement"
                ? "Send a subscription agreement for the client to review and sign."
                : "Create a recurring plan with automatic Stripe billing."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {open ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SubscriptionFormEditor
              key={`new-subscription-${editorKey}`}
              mode="create"
              scrollContainer="parent"
              initialEnrollmentMode={initialEnrollmentMode}
              initialContractTermsId={initialContractTermsId}
              initialPackageId={initialPackageId}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
