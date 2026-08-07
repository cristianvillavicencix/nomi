import { useMutation } from "@tanstack/react-query";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetMany,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  resolveBillingRecipientEmail,
} from "@/modules/billing/billingRecipientResolution";
import {
  SavedCardSelect,
  resolveSavedCardPaymentMethodId,
  savedCardOptionValue,
} from "@/modules/billing/subscriptions/SavedCardSelect";
import {
  SubscriptionStaffCardForm,
  type SubscriptionStaffCardFormHandle,
} from "@/modules/billing/subscriptions/SubscriptionStaffCardForm";
import type { SubscriptionPaymentMode } from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
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

type CollectPaymentMode = Extract<
  SubscriptionPaymentMode,
  "saved_card" | "staff_card"
>;

type CollectSubscriptionPaymentDialogProps = {
  subscription: ClientSubscription;
  mode: CollectPaymentMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CollectSubscriptionPaymentDialog = ({
  subscription,
  mode,
  open,
  onOpenChange,
}: CollectSubscriptionPaymentDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const staffCardRef = useRef<SubscriptionStaffCardFormHandle>(null);
  const [selectedSavedCardValue, setSelectedSavedCardValue] = useState<
    string | null
  >(null);

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

  const recipientEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company: companies[0],
        contact: contacts[0],
      }),
    [companies, contacts],
  );

  const { allSavedCards, isPending: savedCardsPending } =
    useClientSavedPaymentMethod(billTo);

  useEffect(() => {
    if (!open || allSavedCards.length === 0) return;
    setSelectedSavedCardValue(savedCardOptionValue(allSavedCards[0]));
  }, [open, allSavedCards]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (mode === "staff_card") {
        const paymentMethodId =
          (await staffCardRef.current?.confirmCard()) ?? null;
        if (!paymentMethodId) {
          throw new Error("Confirm the card before activating billing");
        }
        return dataProvider.manageClientSubscription({
          subscriptionId: subscription.id,
          action: "apply_payment",
          payment_mode: "staff_card",
          payment_method_id: paymentMethodId,
        });
      }

      const paymentMethodId = resolveSavedCardPaymentMethodId(
        allSavedCards,
        selectedSavedCardValue,
      );
      if (!paymentMethodId) {
        throw new Error("Select a saved card to charge");
      }

      return dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "apply_payment",
        payment_mode: "saved_card",
        payment_method_id: paymentMethodId,
      });
    },
    onSuccess: () => {
      refresh();
      onOpenChange(false);
      notify("Subscription activated with card on file", { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not collect payment", { type: "error" });
    },
  });

  const title =
    mode === "staff_card" ? "Enter client card" : "Use saved card";
  const description =
    mode === "staff_card"
      ? `Enter the client's card securely for ${subscription.name}. Billing starts after you save the card.`
      : `Choose which saved card to charge for ${subscription.name}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "staff_card" ? (
              <CreditCard className="size-5" />
            ) : (
              <Wallet className="size-5" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {mode === "saved_card" ? (
          savedCardsPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading saved cards…
            </div>
          ) : (
            <SavedCardSelect
              cards={allSavedCards}
              value={selectedSavedCardValue}
              onChange={(value) => setSelectedSavedCardValue(value)}
            />
          )
        ) : null}

        {mode === "staff_card" ? (
          <SubscriptionStaffCardForm
            ref={staffCardRef}
            enabled={open && mode === "staff_card"}
            billTo={billTo}
            recipientEmail={recipientEmail}
          />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={
              applyMutation.isPending ||
              (mode === "saved_card" &&
                (savedCardsPending || allSavedCards.length === 0)) ||
              (mode === "staff_card" && !recipientEmail)
            }
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : mode === "staff_card" ? (
              "Save card & activate"
            ) : (
              "Charge saved card"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
