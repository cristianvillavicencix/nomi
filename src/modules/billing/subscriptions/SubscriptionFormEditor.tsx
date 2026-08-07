import { useMutation } from "@tanstack/react-query";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetMany,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { billToSelectionFromClient } from "@/modules/billing/billingUtils";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import { SubscriptionCreateReviewPanel } from "@/modules/billing/subscriptions/SubscriptionCreateReviewPanel";
import { SubscriptionLineItemsEditor } from "@/modules/billing/subscriptions/SubscriptionLineItemsEditor";
import {
  emptySubscriptionLine,
  subscriptionLinesFromRecord,
  subscriptionLinesToPayload,
  subscriptionNameFromLines,
  sumSubscriptionLinesAmount,
} from "@/modules/billing/subscriptions/subscriptionLineUtils";
import {
  SavedCardSelect,
  resolveSavedCardPaymentMethodId,
  savedCardOptionValue,
} from "@/modules/billing/subscriptions/SavedCardSelect";
import {
  formatSavedCardLabel,
  savedCardSourceLabel,
  useClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import {
  SubscriptionStaffCardForm,
  type SubscriptionStaffCardFormHandle,
} from "@/modules/billing/subscriptions/SubscriptionStaffCardForm";
import { resolvePublicAppBaseUrl, resolveSubscriptionSetupShareUrl } from "@/lib/publicAppUrl";
import { buildDefaultSubscriptionSetupMessage, formatSubscriptionAmountLabel } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import {
  computeSubscriptionEndsAt,
  inferSubscriptionPaymentMode,
  parseIsoDateAtStartOfDay,
  resolveDurationFromSubscription,
  SUBSCRIPTION_DURATION_OPTIONS,
  todayIsoDate,
  type SubscriptionDurationValue,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { BILLING_INTERVALS } from "@/modules/proposals/proposalCommercialConstants";
import type { ClientSubscription, LbsDeal } from "@/modules/types";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
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

export type SubscriptionFormEditorHandle = {
  submit: () => void;
  canSubmit: boolean;
  isPending: boolean;
};

type SubscriptionFormEditorProps = {
  mode: "create" | "edit";
  subscription?: ClientSubscription | null;
  readOnly?: boolean;
  hideReviewActions?: boolean;
  /** When "parent", the embedded workspace shell owns vertical scroll. */
  scrollContainer?: "self" | "parent";
  /** Pre-select payment option when opening Edit from the toolbar. */
  initialPaymentMode?: SubscriptionPaymentMode | null;
  onSaved?: (result?: {
    setup_link_stale?: boolean;
    used_saved_card?: boolean;
    used_staff_card?: boolean;
  }) => void;
  onCancel?: () => void;
  onStateChange?: (state: { canSubmit: boolean; isPending: boolean }) => void;
};

export const SubscriptionFormEditor = forwardRef<
  SubscriptionFormEditorHandle,
  SubscriptionFormEditorProps
>(function SubscriptionFormEditor(
  {
    mode,
    subscription,
    readOnly = false,
    hideReviewActions = false,
    scrollContainer = "self",
    onSaved,
    onCancel,
    onStateChange,
    initialPaymentMode = null,
  },
  ref,
) {
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { title: orgTitle } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const staffCardRef = useRef<SubscriptionStaffCardFormHandle>(null);

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription?.company_id ? [subscription.company_id] : [] },
    { enabled: mode === "edit" && Boolean(subscription?.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription?.contact_id ? [subscription.contact_id] : [] },
    { enabled: mode === "edit" && Boolean(subscription?.contact_id) },
  );
  const company = companies[0];
  const contact = contacts[0];

  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    emptySubscriptionLine(),
  ]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [dealId, setDealId] = useState<string>("");
  const [billingInterval, setBillingInterval] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [startsAt, setStartsAt] = useState(todayIsoDate());
  const [duration, setDuration] =
    useState<SubscriptionDurationValue>("ongoing");
  const [customEndDate, setCustomEndDate] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<SubscriptionPaymentMode>("request_setup");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [selectedSavedCardValue, setSelectedSavedCardValue] = useState<
    string | null
  >(null);
  const [hydrated, setHydrated] = useState(mode === "create");

  const isCanceled = subscription?.status === "canceled";
  const isPendingSetup = subscription?.status === "pending_setup";
  const isActiveLike =
    subscription?.status === "active" ||
    subscription?.status === "paused" ||
    subscription?.status === "past_due" ||
    subscription?.status === "trialing";
  const paymentSectionLocked =
    readOnly || isCanceled || (isActiveLike && Boolean(subscription?.stripe_subscription_id));
  const formDisabled = readOnly || isCanceled;

  const {
    savedCard,
    allSavedCards,
    isPending: savedCardPending,
  } = useClientSavedPaymentMethod(billTo);

  const cardOnFile = savedCard
    ? { brand: savedCard.brand, last4: savedCard.last4 }
    : subscription?.payment_method_last4
      ? {
          brand: subscription.payment_method_brand,
          last4: subscription.payment_method_last4,
        }
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

  const subscriptionName = subscriptionNameFromLines(lines);
  const amount = sumSubscriptionLinesAmount(lines);
  const lineItemsPayload = subscriptionLinesToPayload(lines);
  const previewShareUrl = resolveSubscriptionSetupShareUrl({
    setup_share_url: subscription?.setup_share_url,
    setup_short_code: subscription?.setup_short_code,
  });

  const defaultMessage = useMemo(
    () =>
      buildDefaultSubscriptionSetupMessage({
        orgLabel: orgTitle ?? "Latino Business Support",
        subscriptionName,
        subscriptionNumber: (subscription?.subscription_number ?? referenceNumber) || null,
        amountLabel: formatSubscriptionAmountLabel(
          amount,
          subscription?.currency ?? "USD",
          billingInterval,
        ),
        shareUrl: previewShareUrl,
      }),
    [
      orgTitle,
      subscriptionName,
      subscription?.subscription_number,
      referenceNumber,
      amount,
      subscription?.currency,
      billingInterval,
      previewShareUrl,
    ],
  );

  const deliveryMessage = messageEdited ? message.trim() || defaultMessage : defaultMessage;

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

  useEffect(() => {
    if (mode !== "edit" || !subscription || hydrated) return;
    const schedule = resolveDurationFromSubscription(subscription);
    setLines(subscriptionLinesFromRecord(subscription));
    setBillingInterval(subscription.billing_interval);
    setStartsAt(subscription.starts_at?.slice(0, 10) ?? todayIsoDate());
    setDuration(schedule.duration);
    setCustomEndDate(schedule.customEndDate);
    setReferenceNumber(subscription.reference_number ?? "");
    setDealId(subscription.deal_id ? String(subscription.deal_id) : "");
    setPaymentMode(inferSubscriptionPaymentMode(subscription));
    if (initialPaymentMode && isPendingSetup) {
      setPaymentMode(initialPaymentMode);
    }
    setHydrated(true);
  }, [mode, subscription, hydrated, initialPaymentMode, isPendingSetup]);

  useEffect(() => {
    if (mode !== "edit" || !initialPaymentMode || !isPendingSetup || !hydrated) {
      return;
    }
    setPaymentMode(initialPaymentMode);
  }, [mode, initialPaymentMode, isPendingSetup, hydrated]);

  useEffect(() => {
    if (formDisabled || savedCardPending || paymentSectionLocked) return;
    if (savedCard && isPendingSetup) {
      setPaymentMode("saved_card");
    } else if (!savedCard) {
      setPaymentMode((current) =>
        current === "saved_card" ? "request_setup" : current,
      );
    }
  }, [
    formDisabled,
    savedCard,
    savedCardPending,
    paymentSectionLocked,
    isPendingSetup,
    billTo?.contactId,
    billTo?.companyId,
  ]);

  useEffect(() => {
    if (allSavedCards.length === 0) {
      setSelectedSavedCardValue(null);
      return;
    }
    setSelectedSavedCardValue((current) => {
      if (
        current &&
        allSavedCards.some((card) => savedCardOptionValue(card) === current)
      ) {
        return current;
      }
      return savedCardOptionValue(allSavedCards[0]);
    });
  }, [allSavedCards]);

  const selectedSavedPaymentMethodId = useMemo(
    () =>
      resolveSavedCardPaymentMethodId(allSavedCards, selectedSavedCardValue),
    [allSavedCards, selectedSavedCardValue],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        let paymentMethodId: string | null = null;
        if (paymentMode === "staff_card") {
          paymentMethodId = (await staffCardRef.current?.confirmCard()) ?? null;
          if (!paymentMethodId) {
            throw new Error("Confirm the card before creating the subscription");
          }
        } else if (paymentMode === "saved_card") {
          paymentMethodId = selectedSavedPaymentMethodId;
          if (!paymentMethodId) {
            throw new Error("Select a saved card to charge");
          }
        }

        return dataProvider.createClientSubscription({
          company_id: billTo?.companyId ?? null,
          contact_id: billTo?.contactId ?? null,
          deal_id: dealId ? Number(dealId) : null,
          reference_number: referenceNumber.trim() || null,
          name: subscriptionName,
          amount,
          billing_interval: billingInterval,
          starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
          ends_at: endsAtIso,
          payment_mode: paymentMode,
          payment_method_id: paymentMethodId,
          line_items: lineItemsPayload,
          send_email: paymentMode === "request_setup" ? sendEmail : false,
          send_sms: paymentMode === "request_setup" ? sendSms : false,
          email_to: recipientEmail || null,
          sms_to: recipientPhone || null,
          message: messageEdited ? message.trim() || null : null,
          base_url: resolvePublicAppBaseUrl(),
        });
      }

      if (!subscription?.id) {
        throw new Error("Missing subscription");
      }

      let paymentMethodId: string | null = null;
      if (paymentMode === "staff_card" && isPendingSetup) {
        paymentMethodId = (await staffCardRef.current?.confirmCard()) ?? null;
        if (!paymentMethodId) {
          throw new Error("Confirm the card before saving");
        }
      }

      const updateResult = await dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: "update",
        name: subscriptionName,
        amount,
        billing_interval: billingInterval,
        ends_at: endsAtIso,
        reference_number: referenceNumber.trim() || null,
        deal_id: dealId ? Number(dealId) : null,
        line_items: lineItemsPayload,
      });

      if (isPendingSetup && !subscription.stripe_subscription_id) {
        const paymentResult = await dataProvider.manageClientSubscription({
          subscriptionId: subscription.id,
          action: "apply_payment",
          payment_mode: paymentMode,
          payment_method_id:
            paymentMode === "saved_card"
              ? selectedSavedPaymentMethodId
              : paymentMethodId,
          send_email: paymentMode === "request_setup" ? sendEmail : false,
          send_sms: paymentMode === "request_setup" ? sendSms : false,
          email_to: recipientEmail || null,
          sms_to: recipientPhone || null,
          message: messageEdited ? message.trim() || null : null,
          base_url: resolvePublicAppBaseUrl(),
        });
        return {
          ...updateResult,
          ...paymentResult,
        };
      }

      return updateResult;
    },
    onSuccess: (result) => {
      refresh();
      if (mode === "create") {
        setBillTo(null);
        setLines([emptySubscriptionLine()]);
        setReferenceNumber("");
        setDealId("");
        setBillingInterval("monthly");
        setStartsAt(todayIsoDate());
        setDuration("ongoing");
        setCustomEndDate("");
        setPaymentMode("request_setup");
        setMessage("");
        setMessageEdited(false);
      }
      onSaved?.(result);
      if (mode === "create") {
        if (result.used_saved_card || result.used_staff_card) {
          notify("Subscription activated with card on file", { type: "success" });
        } else if (sendEmail || sendSms) {
          notify("Subscription created — setup link sent to client", {
            type: "success",
          });
        } else {
          notify("Subscription created — use Send to deliver the setup link", {
            type: "success",
          });
        }
      } else if (result.setup_link_stale) {
        notify(
          "Subscription updated. Resend the setup link so the client sees the new amount.",
          { type: "warning" },
        );
      } else if (
        isPendingSetup &&
        paymentMode === "request_setup" &&
        !(sendEmail || sendSms)
      ) {
        notify("Subscription saved — use Send to deliver the setup link", {
          type: "success",
        });
      } else {
        notify("Subscription updated", { type: "success" });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not save subscription", { type: "error" });
    },
  });

  const canSubmit =
    !formDisabled &&
    Boolean(billTo) &&
    amount > 0 &&
    subscriptionName.length > 0 &&
    Boolean(identity) &&
    (duration !== "custom" || Boolean(customEndDate)) &&
    (mode === "edit" && isActiveLike
      ? true
      : paymentMode === "saved_card"
        ? Boolean(
            selectedSavedPaymentMethodId ||
              savedCard?.stripePaymentMethodId ||
              subscription?.payment_method_last4,
          )
        : paymentMode === "staff_card"
          ? Boolean(recipientEmail)
          : paymentMode === "request_setup"
            ? Boolean(recipientEmail)
            : false);

  useEffect(() => {
    if (mode !== "edit" || !subscription || billTo) return;
    const next = billToSelectionFromClient({ company, contact });
    if (next) setBillTo(next);
  }, [mode, subscription, company, contact, billTo]);

  useEffect(() => {
    onStateChange?.({
      canSubmit,
      isPending: saveMutation.isPending,
    });
  }, [canSubmit, saveMutation.isPending, onStateChange]);

  useImperativeHandle(ref, () => ({
    submit: () => saveMutation.mutate(),
    canSubmit,
    isPending: saveMutation.isPending,
  }));

  const clientLabel = billTo?.label ?? "";

  const dealCompanyId = billTo?.companyId ?? subscription?.company_id ?? null;
  const { data: dealOptions = [] } = useGetList<LbsDeal>(
    "deals",
    {
      filter: dealCompanyId
        ? { "company_id@eq": String(dealCompanyId) }
        : {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: Boolean(dealCompanyId) },
  );

  const paymentOptionClass = (value: SubscriptionPaymentMode) =>
    cn(
      "flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40",
      paymentMode === value && "border-primary bg-primary/5 ring-1 ring-primary/20",
      formDisabled && "pointer-events-none opacity-60",
    );

  return (
    <div
      className={cn(
        "grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
        scrollContainer === "self" && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      <div className="min-w-0 space-y-5 border-b px-4 py-6 md:border-b-0 md:border-r md:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {mode === "create" ? "Setup" : "Subscription"}
        </p>

        <div
          className={cn(
            "space-y-2",
            (formDisabled || mode === "edit") && "pointer-events-none opacity-60",
          )}
        >
          <Label>Client</Label>
          <BillToClientSearch
            value={billTo}
            onChange={setBillTo}
            searchPlaceholder="Company, client name, or phone…"
          />
        </div>

        <div
          className={cn("space-y-2", formDisabled && "pointer-events-none opacity-60")}
        >
          <SubscriptionLineItemsEditor
            lines={lines}
            onChange={setLines}
            billingInterval={billingInterval}
            onBillingIntervalChange={setBillingInterval}
            disabled={formDisabled}
            currency={subscription?.currency ?? "USD"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subscription-interval">Billing interval</Label>
            <Select
              value={billingInterval}
              disabled={formDisabled}
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
        </div>

        <div
          className={cn(
            "grid gap-3",
            mode === "edit" ? "sm:grid-cols-2" : undefined,
          )}
        >
          {mode === "edit" ? (
            <div className="space-y-2">
              <Label htmlFor="subscription-reference">Internal reference</Label>
              <Input
                id="subscription-reference"
                disabled={formDisabled}
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Optional internal note"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="subscription-deal">Associated deal</Label>
            <Select
              value={dealId || "none"}
              disabled={formDisabled || !dealCompanyId}
              onValueChange={(value) =>
                setDealId(value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="subscription-deal">
                <SelectValue placeholder="Select deal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No deal</SelectItem>
                {dealOptions.map((deal) => (
                  <SelectItem key={String(deal.id)} value={String(deal.id)}>
                    {deal.name ?? `Deal #${deal.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subscription-starts">Starts</Label>
            <Input
              id="subscription-starts"
              type="date"
              disabled={formDisabled || mode === "edit"}
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription-duration">Duration</Label>
            <Select
              value={duration}
              disabled={formDisabled}
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
              disabled={formDisabled}
              value={customEndDate}
              min={startsAt}
              onChange={(event) => setCustomEndDate(event.target.value)}
            />
          </div>
        ) : null}

        {!paymentSectionLocked ? (
          <div className="space-y-3">
            <Label>Payment</Label>
            <RadioGroup
              value={paymentMode}
              onValueChange={(value) =>
                setPaymentMode(value as SubscriptionPaymentMode)
              }
              className="space-y-3"
              disabled={formDisabled}
            >
              <label
                htmlFor="payment-saved-card"
                className={paymentOptionClass("saved_card")}
              >
                <RadioGroupItem
                  id="payment-saved-card"
                  value="saved_card"
                  className="mt-1 shrink-0"
                  disabled={!cardOnFile && !savedCard}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Use card on file</p>
                  {paymentMode === "saved_card" && allSavedCards.length > 0 ? (
                    <div className="mt-3">
                      <SavedCardSelect
                        cards={allSavedCards}
                        value={selectedSavedCardValue}
                        onChange={(value) => setSelectedSavedCardValue(value)}
                        disabled={formDisabled}
                        label="Card to charge"
                      />
                    </div>
                  ) : allSavedCards.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {allSavedCards.map((card) => (
                        <li
                          key={savedCardOptionValue(card)}
                          className="text-xs text-muted-foreground"
                        >
                          {formatSavedCardLabel(card)} ·{" "}
                          {savedCardSourceLabel(card.source)}
                        </li>
                      ))}
                    </ul>
                  ) : subscription?.payment_method_last4 ? (
                    <p className="text-xs text-muted-foreground">
                      {subscription.payment_method_brand ?? "Card"} ····
                      {subscription.payment_method_last4}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No saved card for this client
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
                    Optionally send a secure Stripe checkout link by email or SMS.
                    You can also create now and use Send later.
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
                          value={messageEdited ? message : ""}
                          onChange={(event) => {
                            setMessageEdited(true);
                            setMessage(event.target.value);
                          }}
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
        ) : subscription?.payment_method_last4 ? (
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <p className="font-medium">Payment method on file</p>
            <p className="text-muted-foreground">
              {subscription.payment_method_brand ?? "Card"} ····
              {subscription.payment_method_last4}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-w-0 px-4 py-6 md:px-6">
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
          isPending={saveMutation.isPending}
          onSubmit={() => saveMutation.mutate()}
          onCancel={() => onCancel?.()}
          submitLabel={
            mode === "create" ? "Create subscription" : "Save changes"
          }
          pendingLabel={mode === "create" ? "Creating…" : "Saving…"}
          hideActions={hideReviewActions}
        />
      </div>
    </div>
  );
});
