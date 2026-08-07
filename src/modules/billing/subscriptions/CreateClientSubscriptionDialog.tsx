import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { CatalogLineItemField } from "@/modules/billing/CatalogLineItemField";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import { SubscriptionCreateReviewPanel } from "@/modules/billing/subscriptions/SubscriptionCreateReviewPanel";
import {
  formatSavedCardLabel,
  savedCardSourceLabel,
  useClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import {
  SubscriptionStaffCardForm,
  type SubscriptionStaffCardFormHandle,
} from "@/modules/billing/subscriptions/SubscriptionStaffCardForm";
import { buildDefaultSubscriptionSetupMessage } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import {
  computeSubscriptionEndsAt,
  parseIsoDateAtStartOfDay,
  SUBSCRIPTION_DURATION_OPTIONS,
  todayIsoDate,
  type SubscriptionDurationValue,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { BILLING_INTERVALS } from "@/modules/proposals/proposalCommercialConstants";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateClientSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const emptyLine = (): InvoiceLineDraft => ({
  key: crypto.randomUUID(),
  title: "",
  item_detail: "",
  quantity: 1,
  unit: "ea",
  unit_price: 0,
  sort_order: 0,
});

const resetFormState = () => ({
  billTo: null as BillToSelection | null,
  line: emptyLine(),
  billingInterval: "monthly" as "weekly" | "monthly" | "yearly",
  startsAt: todayIsoDate(),
  duration: "ongoing" as SubscriptionDurationValue,
  customEndDate: "",
  paymentMode: "request_setup" as SubscriptionPaymentMode,
  sendEmail: true,
  sendSms: true,
  message: "",
});

export const CreateClientSubscriptionDialog = ({
  open,
  onOpenChange,
}: CreateClientSubscriptionDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { title: orgTitle } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const staffCardRef = useRef<SubscriptionStaffCardFormHandle>(null);

  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [line, setLine] = useState<InvoiceLineDraft>(emptyLine);
  const [billingInterval, setBillingInterval] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [startsAt, setStartsAt] = useState(todayIsoDate());
  const [duration, setDuration] =
    useState<SubscriptionDurationValue>("ongoing");
  const [customEndDate, setCustomEndDate] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<SubscriptionPaymentMode>("request_setup");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [message, setMessage] = useState("");

  const {
    savedCard,
    allSavedCards,
    isPending: savedCardPending,
  } = useClientSavedPaymentMethod(billTo);

  const cardOnFile = savedCard
    ? { brand: savedCard.brand, last4: savedCard.last4 }
    : null;

  const recipientEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const recipientPhone = useMemo(
    () =>
      resolveBillingRecipientPhone({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const subscriptionName = line.title.trim() || "Subscription";
  const amount = Number(line.unit_price) || 0;
  const checkoutPlaceholder = "https://checkout.stripe.com/…";

  const endsAtIso = useMemo(() => {
    const startDate = new Date(`${startsAt}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) return null;
    const end = computeSubscriptionEndsAt({
      startsAt: startDate,
      duration,
      customEndDate,
    });
    return end ? end.toISOString() : null;
  }, [startsAt, duration, customEndDate]);

  const endsAtDateForReview = useMemo(() => {
    if (duration === "ongoing") return null;
    if (duration === "custom") return customEndDate || null;
    const startDate = parseIsoDateAtStartOfDay(startsAt);
    if (!startDate) return null;
    const end = computeSubscriptionEndsAt({
      startsAt: startDate,
      duration,
      customEndDate,
    });
    return end ? end.toISOString().slice(0, 10) : null;
  }, [startsAt, duration, customEndDate]);

  const defaultMessage = useMemo(
    () =>
      buildDefaultSubscriptionSetupMessage({
        orgLabel: orgTitle ?? "Latino Business Support",
        subscriptionName,
        checkoutUrl: checkoutPlaceholder,
      }),
    [orgTitle, subscriptionName],
  );

  const deliveryMessage = message.trim() || defaultMessage;

  useEffect(() => {
    if (!open) return;
    setSendEmail(Boolean(recipientEmail));
    setSendSms(Boolean(recipientPhone));
  }, [open, recipientEmail, recipientPhone]);

  useEffect(() => {
    if (!open || savedCardPending) return;
    if (savedCard) {
      setPaymentMode("saved_card");
    } else {
      setPaymentMode((current) =>
        current === "saved_card" ? "request_setup" : current,
      );
    }
  }, [
    open,
    savedCard,
    savedCardPending,
    billTo?.contactId,
    billTo?.companyId,
  ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      let paymentMethodId: string | null = null;
      if (paymentMode === "staff_card") {
        paymentMethodId = (await staffCardRef.current?.confirmCard()) ?? null;
        if (!paymentMethodId) {
          throw new Error("Confirm the card before creating the subscription");
        }
      }

      return dataProvider.createClientSubscription({
        company_id: billTo?.companyId ?? null,
        contact_id: billTo?.contactId ?? null,
        name: subscriptionName,
        amount,
        billing_interval: billingInterval,
        starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
        ends_at: endsAtIso,
        payment_mode: paymentMode,
        payment_method_id: paymentMethodId,
        line_items: [
          {
            description: subscriptionName,
            quantity: 1,
            unit: line.unit ?? "ea",
            unit_price: amount,
            package_id: line.package_id ?? null,
            addon_id: line.addon_id ?? null,
          },
        ],
        send_email: paymentMode === "request_setup" ? sendEmail : false,
        send_sms: paymentMode === "request_setup" ? sendSms : false,
        email_to: recipientEmail || null,
        sms_to: recipientPhone || null,
        message: deliveryMessage,
        base_url: window.location.origin,
      });
    },
    onSuccess: (result) => {
      refresh();
      onOpenChange(false);
      const reset = resetFormState();
      setBillTo(reset.billTo);
      setLine(reset.line);
      setBillingInterval(reset.billingInterval);
      setStartsAt(reset.startsAt);
      setDuration(reset.duration);
      setCustomEndDate(reset.customEndDate);
      setPaymentMode(reset.paymentMode);
      setMessage(reset.message);

      if (result.used_saved_card || result.used_staff_card) {
        notify("Subscription activated with card on file", { type: "success" });
      } else {
        notify("Subscription created — setup link sent to client", {
          type: "success",
        });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not create subscription", { type: "error" });
    },
  });

  const canSubmit =
    Boolean(billTo) &&
    amount > 0 &&
    subscriptionName.length > 0 &&
    Boolean(identity) &&
    (duration !== "custom" || Boolean(customEndDate)) &&
    (paymentMode === "saved_card"
      ? Boolean(savedCard)
      : paymentMode === "staff_card"
        ? Boolean(recipientEmail)
        : (sendEmail && Boolean(recipientEmail)) ||
          (sendSms && Boolean(recipientPhone)));

  const clientLabel = billTo?.label ?? "";

  const paymentOptionClass = (mode: SubscriptionPaymentMode) =>
    cn(
      "flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40",
      paymentMode === mode && "border-primary bg-primary/5 ring-1 ring-primary/20",
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,76rem)] max-w-none flex-col overflow-hidden p-0 sm:max-w-[76rem]"
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

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 space-y-5 border-b px-8 py-6 md:border-b-0 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Setup
            </p>

            <div className="space-y-2">
              <Label>Client</Label>
              <BillToClientSearch
                value={billTo}
                onChange={setBillTo}
                searchPlaceholder="Company, client name, or phone…"
              />
            </div>

            <div className="space-y-2">
              <Label>Service</Label>
              <CatalogLineItemField
                line={line}
                billingTypeFilter="recurring"
                defaultBillingInterval={billingInterval}
                suggestionMinWidth={520}
                onCatalogPick={({ billing_interval }) => {
                  if (billing_interval) setBillingInterval(billing_interval);
                }}
                onChange={(patch) =>
                  setLine((current) => ({ ...current, ...patch }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-interval">Billing interval</Label>
                <Select
                  value={billingInterval}
                  onValueChange={(value) =>
                    setBillingInterval(value as "weekly" | "monthly" | "yearly")
                  }
                >
                  <SelectTrigger id="subscription-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_INTERVALS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-amount">Amount (USD)</Label>
                <Input
                  id="subscription-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(amount) ? amount : ""}
                  onChange={(event) =>
                    setLine((current) => ({
                      ...current,
                      unit_price: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-starts">Starts</Label>
                <Input
                  id="subscription-starts"
                  type="date"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-duration">Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(value) =>
                    setDuration(value as SubscriptionDurationValue)
                  }
                >
                  <SelectTrigger id="subscription-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTION_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {duration === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="subscription-ends">End date</Label>
                <Input
                  id="subscription-ends"
                  type="date"
                  value={customEndDate}
                  min={startsAt}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <Label>Payment</Label>
              <RadioGroup
                value={paymentMode}
                onValueChange={(value) =>
                  setPaymentMode(value as SubscriptionPaymentMode)
                }
                className="space-y-3"
              >
                <label
                  htmlFor="payment-saved-card"
                  className={paymentOptionClass("saved_card")}
                >
                  <RadioGroupItem
                    id="payment-saved-card"
                    value="saved_card"
                    className="mt-1 shrink-0"
                    disabled={!cardOnFile}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Use card on file</p>
                    {allSavedCards.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {allSavedCards.map((card) => (
                          <li
                            key={`${card.source}-${card.last4}`}
                            className="text-xs text-muted-foreground"
                          >
                            {formatSavedCardLabel(card)} ·{" "}
                            {savedCardSourceLabel(card.source)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No saved card for this client (from invoices, tickets, or
                        proposals)
                      </p>
                    )}
                  </div>
                </label>

                <label
                  htmlFor="payment-staff-card"
                  className={paymentOptionClass("staff_card")}
                >
                  <RadioGroupItem
                    id="payment-staff-card"
                    value="staff_card"
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Enter card (client present)
                    </p>
                    {paymentMode === "staff_card" ? (
                      <div className="mt-3">
                        <SubscriptionStaffCardForm
                          ref={staffCardRef}
                          enabled={paymentMode === "staff_card"}
                          billTo={billTo}
                          recipientEmail={recipientEmail}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Staff-assisted Stripe card entry
                      </p>
                    )}
                  </div>
                </label>

                <label
                  htmlFor="payment-request-setup"
                  className={paymentOptionClass("request_setup")}
                >
                  <RadioGroupItem
                    id="payment-request-setup"
                    value="request_setup"
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Request card from client
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Send a secure Stripe checkout link by email and SMS
                    </p>
                    {paymentMode === "request_setup" ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 xl:grid-cols-2">
                          <label className="flex min-w-0 items-start gap-2 text-sm">
                            <Checkbox
                              checked={sendEmail}
                              onCheckedChange={(checked) =>
                                setSendEmail(checked === true)
                              }
                              disabled={!recipientEmail}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 break-all">
                              Email
                              {recipientEmail ? `: ${recipientEmail}` : ""}
                            </span>
                          </label>
                          <label className="flex min-w-0 items-start gap-2 text-sm">
                            <Checkbox
                              checked={sendSms}
                              onCheckedChange={(checked) =>
                                setSendSms(checked === true)
                              }
                              disabled={!recipientPhone}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 break-all">
                              SMS
                              {recipientPhone ? `: ${recipientPhone}` : ""}
                            </span>
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subscription-message">Message</Label>
                          <Textarea
                            id="subscription-message"
                            rows={4}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder={defaultMessage}
                            className="min-h-24"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="min-w-0 px-8 py-6">
            <SubscriptionCreateReviewPanel
              clientLabel={clientLabel}
              subscriptionName={subscriptionName}
              amount={amount}
              billingInterval={billingInterval}
              startsAtDate={startsAt}
              endsAtDate={endsAtDateForReview}
              paymentMode={paymentMode}
              cardOnFile={cardOnFile}
              savedCards={allSavedCards}
              recipientEmail={recipientEmail}
              recipientPhone={recipientPhone}
              sendEmail={sendEmail}
              sendSms={sendSms}
              deliveryMessage={deliveryMessage}
              orgTitle={orgTitle ?? "Latino Business Support"}
              canSubmit={canSubmit}
              isPending={createMutation.isPending}
              onSubmit={() => createMutation.mutate()}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
