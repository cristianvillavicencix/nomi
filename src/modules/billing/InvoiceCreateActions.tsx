import { Loader2, Send, Settings2, CreditCard } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export type InvoiceCreateAction =
  | "draft"
  | "send"
  | "share"
  | "send_later"
  | "print";

type InvoiceCreateActionsProps = {
  isPending: boolean;
  pendingAction: InvoiceCreateAction | null;
  onAction: (action: InvoiceCreateAction) => void;
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
        onClick={() => onAction("send")}
      >
        {isActionPending("send") ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Send
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
