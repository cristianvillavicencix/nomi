import { Loader2, ChevronDown, Clock, CreditCard, ExternalLink, Printer, Send, Settings2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
          Configure payment
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
        variant="outline"
        disabled={isPending}
        onClick={() => onAction("draft")}
      >
        {isActionPending("draft") ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        Save
      </Button>

      <div className="flex">
        <Button
          type="button"
          disabled={isPending}
          className="rounded-r-none"
          onClick={() => onAction("send")}
        >
          {isActionPending("send") ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Save and Send
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              disabled={isPending}
              className="rounded-l-none border-l border-primary-foreground/20 px-2"
              aria-label="More save options"
            >
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => onAction("print")}
            >
              <Printer className="size-4" />
              Save and Print
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => onAction("share")}
            >
              <ExternalLink className="size-4" />
              Save and Share
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => onAction("send_later")}
            >
              <Clock className="size-4" />
              Save and Send Later
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button type="button" variant="outline" asChild>
        <Link
          to={cancelTo}
          aria-disabled={isPending}
          tabIndex={isPending ? -1 : 0}
        >
          Cancel
        </Link>
      </Button>
    </div>
  );
};
