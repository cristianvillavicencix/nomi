import { Loader2, Send, Settings2, CreditCard } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export type InvoiceCreateAction =
  | "draft"
  | "send"
  | "share"
  | "send_later"
  | "print"
  | "update"
  | "resend";

type InvoiceCreateActionsProps = {
  isPending: boolean;
  pendingAction: InvoiceCreateAction | null;
  onAction: (action: InvoiceCreateAction) => void;
  /** Primary button label (defaults to Send). */
  primaryLabel?: string;
  /** Primary button action (defaults to send). */
  primaryAction?: InvoiceCreateAction;
  /** Show a subtle badge when the invoice was updated but not resent yet. */
  showUpdatedBadge?: boolean;
  /** Cancel link target (defaults to Billing list). */
  cancelTo?: string;
  /** When false, hides the Cancel button (e.g. embedded invoice workspace). */
  showCancel?: boolean;
  onConfigurePayment?: () => void;
  showCharge?: boolean;
  onCharge?: () => void;
  chargeDisabled?: boolean;
};

export const InvoiceCreateActions = ({
  isPending,
  pendingAction,
  onAction,
  primaryLabel = "Send",
  primaryAction = "send",
  showUpdatedBadge = false,
  cancelTo = "/billing",
  showCancel = true,
  onConfigurePayment,
  showCharge = false,
  onCharge,
  chargeDisabled = false,
}: InvoiceCreateActionsProps) => {
  const isActionPending = (action: InvoiceCreateAction) =>
    isPending && pendingAction === action;

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      {showUpdatedBadge ? (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
          Updated — resend to client
        </span>
      ) : null}
      {onConfigurePayment ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onConfigurePayment}
        >
          <Settings2 className="size-4" />
          Payments
        </Button>
      ) : null}

      {showCharge && onCharge ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending || chargeDisabled}
          onClick={onCharge}
        >
          <CreditCard className="size-4" />
          Charge
        </Button>
      ) : null}

      <Button
        type="button"
        disabled={isPending}
        onClick={() => onAction(primaryAction)}
      >
        {isActionPending(primaryAction) ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {primaryLabel}
      </Button>

      {showCancel ? (
        <Button type="button" variant="outline" asChild>
          <Link
            to={cancelTo}
            aria-disabled={isPending}
            tabIndex={isPending ? -1 : 0}
          >
            Cancel
          </Link>
        </Button>
      ) : null}
    </div>
  );
};
