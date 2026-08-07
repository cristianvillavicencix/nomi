import { ChevronRight, CreditCard, Link2, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useGetMany } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  formatSubscriptionAmountLabel,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import {
  subscriptionPaymentModeLabel,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { useClientSavedPaymentMethod } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientSubscription } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FinishSubscriptionSetupAction = Extract<
  SubscriptionPaymentMode,
  "saved_card" | "staff_card" | "request_setup"
>;

type FinishSubscriptionSetupDialogProps = {
  subscription: ClientSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (action: FinishSubscriptionSetupAction) => void;
};

const SETUP_OPTIONS: Array<{
  action: FinishSubscriptionSetupAction;
  icon: typeof Wallet;
  description: string;
}> = [
  {
    action: "saved_card",
    icon: Wallet,
    description: "Charge a card already on file for this customer",
  },
  {
    action: "staff_card",
    icon: CreditCard,
    description: "Enter card details securely with the client present",
  },
  {
    action: "request_setup",
    icon: Link2,
    description: "Email or text a secure Stripe checkout link",
  },
];

export const FinishSubscriptionSetupDialog = ({
  subscription,
  open,
  onOpenChange,
  onSelectAction,
}: FinishSubscriptionSetupDialogProps) => {
  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription.company_id ? [subscription.company_id] : [] },
    { enabled: open && Boolean(subscription.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription.contact_id ? [subscription.contact_id] : [] },
    { enabled: open && Boolean(subscription.contact_id) },
  );

  const billTo = useMemo(
    () =>
      billToSelectionFromClient({
        company: companies[0],
        contact: contacts[0],
      }),
    [companies, contacts],
  );

  const { allSavedCards } = useClientSavedPaymentMethod(billTo);
  const hasSavedCard =
    allSavedCards.length > 0 || Boolean(subscription.payment_method_last4?.trim());

  const amountLabel = formatSubscriptionAmountLabel(
    Number(subscription.amount),
    subscription.currency,
    subscription.billing_interval,
  );

  const handleSelect = (action: FinishSubscriptionSetupAction) => {
    onOpenChange(false);
    onSelectAction(action);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish setup</DialogTitle>
          <DialogDescription>
            Activate billing for{" "}
            <span className="font-medium text-foreground">
              {subscription.name}
            </span>{" "}
            ({amountLabel}). Choose how to collect the payment method.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs text-muted-foreground">
          <li className="font-medium text-foreground">1. Choose method</li>
          <li aria-hidden="true">→</li>
          <li>2. Confirm & activate</li>
        </ol>

        <div className="space-y-2">
          {SETUP_OPTIONS.map(({ action, icon: Icon, description }) => {
            const disabled = action === "saved_card" && !hasSavedCard;
            return (
              <button
                key={action}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(action)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {subscriptionPaymentModeLabel(action)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                  </span>
                  {disabled ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      No saved card on file for this customer.
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
