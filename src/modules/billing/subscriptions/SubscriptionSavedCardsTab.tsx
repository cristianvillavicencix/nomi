import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetMany,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import { resolveBillingRecipientEmail } from "@/modules/billing/billingRecipientResolution";
import { SendSubscriptionSetupDialog } from "@/modules/billing/subscriptions/SendSubscriptionSetupDialog";
import {
  SubscriptionStaffCardForm,
  type SubscriptionStaffCardFormHandle,
} from "@/modules/billing/subscriptions/SubscriptionStaffCardForm";
import {
  formatPaymentMethodLabel,
  formatSavedCardLabel,
  formatSavedCardMask,
  savedCardSourceLabel,
  useClientSavedPaymentMethod,
  type ClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StripeListedCard = {
  id: string;
  brand: string | null;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
};

type DisplayCard = {
  key: string;
  brand: string | null;
  last4: string;
  sourceLabel: string;
  paymentMethodId: string | null;
  expLabel: string | null;
  updatedAt: string | null;
};

type SubscriptionSavedCardsTabProps = {
  subscription: ClientSubscription;
};

const isCurrentBillingCard = (
  paymentMethodId: string | null,
  last4: string,
  brand: string | null,
  subscription: ClientSubscription,
) => {
  const currentId = subscription.stripe_payment_method_id?.trim();
  if (paymentMethodId && currentId && paymentMethodId === currentId) {
    return true;
  }
  const currentLast4 = subscription.payment_method_last4?.trim();
  if (!last4 || !currentLast4 || last4 !== currentLast4) return false;
  const currentBrand = (subscription.payment_method_brand ?? "").toLowerCase();
  const cardBrand = (brand ?? "").toLowerCase();
  return !cardBrand || !currentBrand || cardBrand === currentBrand;
};

const toDisplayFromStripe = (card: StripeListedCard): DisplayCard => ({
  key: card.id,
  brand: card.brand,
  last4: card.last4,
  sourceLabel: "Stripe customer",
  paymentMethodId: card.id,
  expLabel:
    card.exp_month && card.exp_year
      ? `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`
      : null,
  updatedAt: null,
});

const toDisplayFromCrm = (card: ClientSavedPaymentMethod): DisplayCard => ({
  key:
    card.stripePaymentMethodId?.trim() ||
    `${card.source}-${card.brand}-${card.last4}`,
  brand: card.brand,
  last4: card.last4,
  sourceLabel: savedCardSourceLabel(card.source),
  paymentMethodId: card.stripePaymentMethodId?.trim() || null,
  expLabel: null,
  updatedAt: card.updatedAt,
});

export const SubscriptionSavedCardsTab = ({
  subscription,
}: SubscriptionSavedCardsTabProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const staffCardRef = useRef<SubscriptionStaffCardFormHandle>(null);
  const [requestCardOpen, setRequestCardOpen] = useState(false);
  const [enterCardOpen, setEnterCardOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription.company_id ? [subscription.company_id] : [] },
    { enabled: Boolean(subscription.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription.contact_id ? [subscription.contact_id] : [] },
    { enabled: Boolean(subscription.contact_id) },
  );

  const billTo = billToSelectionFromClient({
    company: companies[0],
    contact: contacts[0],
  });
  const recipientEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company: companies[0],
        contact: contacts[0],
      }),
    [companies, contacts],
  );
  const { allSavedCards, isPending: crmPending, refetch: refetchCrm } =
    useClientSavedPaymentMethod(billTo);

  const canManageCards =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due" ||
    subscription.status === "paused";

  const stripeCardsQuery = useQuery({
    queryKey: [
      "subscription-payment-methods",
      subscription.id,
      subscription.stripe_customer_id,
    ],
    queryFn: async () => {
      const result = await dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "list_payment_methods",
      });
      return (result.payment_methods ?? []) as StripeListedCard[];
    },
    enabled: Boolean(subscription.stripe_customer_id?.trim()),
  });

  const displayCards = useMemo(() => {
    const stripeCards = (stripeCardsQuery.data ?? []).map(toDisplayFromStripe);
    if (stripeCards.length > 0) return stripeCards;

    // Fallback while Stripe customer is missing or still loading CRM history.
    return allSavedCards.map(toDisplayFromCrm);
  }, [allSavedCards, stripeCardsQuery.data]);

  const invalidateCards = async () => {
    await Promise.all([
      refetchCrm(),
      queryClient.invalidateQueries({
        queryKey: ["subscription-payment-methods", subscription.id],
      }),
    ]);
  };

  const setDefaultMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "update_payment_method",
        payment_method_id: paymentMethodId,
      }),
    onSuccess: async () => {
      refresh();
      await invalidateCards();
      notify("Billing card updated — future charges will use this card", {
        type: "success",
      });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update billing card", {
        type: "error",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "detach_payment_method",
        payment_method_id: paymentMethodId,
      }),
    onSuccess: async () => {
      setConfirmRemoveId(null);
      refresh();
      await invalidateCards();
      notify("Card removed", { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not remove card", { type: "error" });
    },
  });

  const addCardMutation = useMutation({
    mutationFn: async () => {
      const paymentMethodId = await staffCardRef.current?.confirmCard();
      if (!paymentMethodId) {
        throw new Error("Enter and confirm the card details first");
      }
      return dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "update_payment_method",
        payment_method_id: paymentMethodId,
      });
    },
    onSuccess: async () => {
      setEnterCardOpen(false);
      refresh();
      await invalidateCards();
      notify("Card saved and set for billing", { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not save card", { type: "error" });
    },
  });

  const busy =
    setDefaultMutation.isPending ||
    addCardMutation.isPending ||
    removeMutation.isPending;
  const isPending = crmPending || stripeCardsQuery.isPending;

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">Loading saved cards…</p>
    );
  }

  return (
    <div className="space-y-4">
      <SendSubscriptionSetupDialog
        subscription={subscription}
        open={requestCardOpen}
        onOpenChange={setRequestCardOpen}
        mode="card_update"
      />

      <Dialog open={enterCardOpen} onOpenChange={setEnterCardOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enter card</DialogTitle>
            <DialogDescription>
              Save a new card for this client and use it for future charges on{" "}
              {subscription.name}.
            </DialogDescription>
          </DialogHeader>
          <SubscriptionStaffCardForm
            ref={staffCardRef}
            enabled={enterCardOpen}
            billTo={billTo}
            recipientEmail={recipientEmail}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setEnterCardOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !canManageCards}
              onClick={() => addCardMutation.mutate()}
            >
              {addCardMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CreditCard className="size-4" />
              )}
              Save & use for billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmRemoveId)}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove card?</DialogTitle>
            <DialogDescription>
              This detaches the card from the Stripe customer. It cannot be used
              for future charges unless added again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmRemoveId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !confirmRemoveId}
              onClick={() => {
                if (!confirmRemoveId) return;
                removeMutation.mutate(confirmRemoveId);
              }}
            >
              {removeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Choose which card Stripe should charge for this subscription. You can
          also add or remove cards.
        </p>
        {canManageCards ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={busy}>
                <Plus className="size-3.5" />
                Add card
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEnterCardOpen(true)}>
                <CreditCard className="size-4" />
                Enter manually
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRequestCardOpen(true)}>
                <Send className="size-4" />
                Request from client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {!displayCards.length ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No saved cards for this client yet.
          {canManageCards
            ? " Add one manually or request a secure link from the client."
            : " Finish setup or collect a card on an invoice to add one."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCards.map((card) => {
                const isCurrent = isCurrentBillingCard(
                  card.paymentMethodId,
                  card.last4,
                  card.brand,
                  subscription,
                );
                return (
                  <TableRow
                    key={card.key}
                    className={cn(isCurrent && "bg-primary/5")}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {formatSavedCardLabel({
                            brand: card.brand,
                            last4: card.last4,
                            source: "subscription",
                            updatedAt: card.updatedAt,
                          })}
                        </span>
                        {isCurrent ? (
                          <Badge variant="default" className="text-[10px]">
                            Used for billing
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {card.sourceLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {card.expLabel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {isCurrent ? (
                          <span className="px-2 text-xs text-muted-foreground">
                            Current
                          </span>
                        ) : canManageCards && card.paymentMethodId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7"
                            disabled={busy}
                            onClick={() =>
                              setDefaultMutation.mutate(card.paymentMethodId!)
                            }
                          >
                            {setDefaultMutation.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : null}
                            Use for billing
                          </Button>
                        ) : null}
                        {canManageCards && card.paymentMethodId && !isCurrent ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={busy}
                            onClick={() =>
                              setConfirmRemoveId(card.paymentMethodId)
                            }
                            aria-label="Remove card"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {subscription.stripe_payment_method_id ||
      subscription.payment_method_brand ||
      subscription.payment_method_last4 ? (
        <p className="text-xs text-muted-foreground">
          Stripe currently charges{" "}
          <span className="font-medium text-foreground">
            {formatPaymentMethodLabel(
              subscription.payment_method_brand,
              subscription.payment_method_last4,
            )}
          </span>{" "}
          for renewals on this subscription.
        </p>
      ) : null}
    </div>
  );
};
