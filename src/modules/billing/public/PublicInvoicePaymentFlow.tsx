import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type StripePaymentElementChangeEvent,
} from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isClientBillingSkipped } from "@/modules/billing/clientBillingProvider";
import {
  parseInvoiceRemainderSchedule,
  previewRemainderScheduleAfterPayments,
} from "@/modules/billing/invoiceRemainderSchedule";
import {
  buildInvoiceAmortizationSchedule,
  buildInvoicePaymentSchedule,
  computeInvoiceUpfrontAmount,
  computeInvoiceBalanceDue,
} from "@/modules/billing/invoicePaymentUtils";
import { InvoicePaymentSchedulePanel } from "@/modules/billing/InvoicePaymentSchedulePanel";
import { InvoicePaymentAmountPicker } from "@/modules/billing/public/InvoicePaymentAmountPicker";
import {
  filterRemainderInstallmentRows,
  invoicePaymentConsentLabelForAmount,
  isInvoiceDepositPaid,
  isValidInvoicePaymentAmount,
  mapToRemainderInstallmentNumbers,
  resolveDefaultSelectedInstallmentNumbers,
  resolveEffectiveInstallmentSelection,
  resolveInvoicePaymentAmount,
} from "@/modules/billing/public/invoicePaymentAmount";
import {
  isPublicInvoiceAlreadyPaidError,
  payPublicClientInvoice,
  preparePublicClientInvoicePayment,
  type PublicInvoicePayload,
} from "@/modules/billing/public/publicInvoiceApi";
import {
  clearStoredInvoicePaymentIntentId,
  readStoredInvoicePaymentIntentId,
  writeStoredInvoicePaymentIntentId,
} from "@/modules/billing/public/invoicePaymentIntentStorage";
import {
  publicInvoicePaymentSectionPadding,
  publicInvoicePaymentShellClass,
  focusPaymentEntryShellClass,
} from "@/modules/billing/public/payInvoiceDialogLayout";
import {
  PublicInvoicePaymentCardHeading,
  PublicInvoicePaymentSummary,
} from "@/modules/billing/public/PublicInvoicePaymentSummary";
import { cn } from "@/lib/utils";

const envPublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

const resolveStripePublishableKey = (
  payload?: PublicInvoicePayload | null,
  override?: string | null,
) =>
  override?.trim() ||
  payload?.stripe_publishable_key?.trim() ||
  envPublishableKey?.trim() ||
  null;

const stripeElementsAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#2563eb",
    borderRadius: "12px",
    fontFamily: "system-ui, sans-serif",
  },
};

const paymentElementOptions = {
  layout: {
    type: "tabs" as const,
    defaultCollapsed: false,
  },
  paymentMethodOrder: ["apple_pay", "google_pay", "card"],
  wallets: {
    applePay: "auto" as const,
    googlePay: "auto" as const,
  },
  // Mandate copy is shown in our consent checkbox below (English).
  terms: {
    card: "never" as const,
    applePay: "never" as const,
    googlePay: "never" as const,
  },
};

/** Payment link: card field only — no wallets or extra payment tabs. */
const cardOnlyPaymentElementOptions = {
  layout: {
    type: "accordion" as const,
    defaultCollapsed: false,
    radios: "never" as const,
    spacedAccordionItems: false,
  },
  paymentMethodOrder: ["card"],
  wallets: {
    applePay: "never" as const,
    googlePay: "never" as const,
  },
  terms: {
    card: "never" as const,
  },
};

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const resolveFocusPaymentEntryLabels = (
  summary: InvoicePaymentSummary,
  selectedAmount: number,
  currency: string,
) => {
  const savingCard =
    summary.saveCardForFutureCharges || summary.autoChargeRemainder;

  if (!savingCard) {
    return {
      submitLabel: `Pay ${formatMoney(selectedAmount, currency)}`,
      pendingLabel: "Processing…",
      footnote: null as string | null,
    };
  }

  const chargeToday = selectedAmount > 0.01;
  return {
    submitLabel: "Add card",
    pendingLabel: "Adding card…",
    footnote: chargeToday
      ? `A payment of ${formatMoney(selectedAmount, currency)} will be processed today. Your card is saved for future automatic charges.`
      : "Your card is saved securely with Stripe for scheduled payments on this invoice.",
  };
};

type PaymentFlowProps = {
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
  /** Payment link: card entry only — no invoice summary or amount picker. */
  focusPaymentEntry?: boolean;
  /** Bottom-sheet layout: sticky pay footer + full-width body. */
  sheetLayout?: boolean;
};

type InvoicePaymentSummary = {
  currency: string;
  total: number;
  amountPaid: number;
  depositPaid: boolean;
  balanceDue: number;
  balanceDueFormatted: string;
  chargeAmount: number;
  upfrontPercent: number;
  autoChargeRemainder: boolean;
  saveCardForFutureCharges: boolean;
  remainderSchedule: ReturnType<typeof parseInvoiceRemainderSchedule>;
  scheduleRows: ReturnType<typeof buildInvoicePaymentSchedule>;
  amortizationRows: ReturnType<typeof buildInvoiceAmortizationSchedule>;
  dueDate: string;
  issueDate: string;
  isPaid: boolean;
};

const buildPaymentSummary = (
  payload: PublicInvoicePayload,
): InvoicePaymentSummary => {
  const { invoice } = payload;
  const currency = invoice.currency ?? "USD";
  const total = Number(invoice.amount) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const balanceDue = computeInvoiceBalanceDue(total, amountPaid);
  const chargeAmount = computeInvoiceUpfrontAmount(
    total,
    upfrontPercent,
    amountPaid,
  );
  const remainderSchedule = parseInvoiceRemainderSchedule(
    invoice.remainder_schedule,
    invoice.due_date,
  );
  const scheduleParams = {
    total,
    amountPaid,
    upfrontPercent,
    autoChargeRemainder: invoice.auto_charge_remainder,
    saveCard: invoice.save_card_for_future_charges,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
    remainderSchedule,
  };

  return {
    currency,
    total,
    amountPaid,
    depositPaid: isInvoiceDepositPaid(total, upfrontPercent, amountPaid),
    balanceDue,
    balanceDueFormatted: formatMoney(balanceDue, currency),
    chargeAmount,
    upfrontPercent,
    autoChargeRemainder: Boolean(invoice.auto_charge_remainder),
    saveCardForFutureCharges: Boolean(invoice.save_card_for_future_charges),
    remainderSchedule,
    scheduleRows: buildInvoicePaymentSchedule(scheduleParams),
    amortizationRows: buildInvoiceAmortizationSchedule(scheduleParams),
    dueDate: invoice.due_date ?? new Date().toISOString().slice(0, 10),
    issueDate: invoice.issue_date ?? new Date().toISOString().slice(0, 10),
    isPaid: invoice.status === "paid" || balanceDue <= 0,
  };
};

const useInvoicePaymentAmountState = (summary: InvoicePaymentSummary) => {
  const upcomingInstallments = useMemo(
    () => filterRemainderInstallmentRows(summary.amortizationRows),
    [summary.amortizationRows],
  );

  const defaultSelection = useMemo(
    () =>
      resolveDefaultSelectedInstallmentNumbers(
        upcomingInstallments,
        summary.depositPaid,
      ),
    [upcomingInstallments, summary.depositPaid],
  );

  const [selectedInstallmentNumbers, setSelectedInstallmentNumbers] =
    useState<number[]>(defaultSelection);

  useEffect(() => {
    setSelectedInstallmentNumbers(defaultSelection);
  }, [defaultSelection]);

  const effectiveSelectedInstallmentNumbers = useMemo(
    () =>
      resolveEffectiveInstallmentSelection(
        selectedInstallmentNumbers,
        upcomingInstallments,
        summary.depositPaid,
      ),
    [selectedInstallmentNumbers, upcomingInstallments, summary.depositPaid],
  );

  const toggleInstallment = (paymentNumber: number) => {
    setSelectedInstallmentNumbers((prev) =>
      prev.includes(paymentNumber)
        ? prev.filter((value) => value !== paymentNumber)
        : [...prev, paymentNumber],
    );
  };

  const selectAllInstallments = () => {
    setSelectedInstallmentNumbers(
      upcomingInstallments.map((row) => row.paymentNumber),
    );
  };

  const selectedAmount = useMemo(
    () =>
      resolveInvoicePaymentAmount({
        selectedInstallmentNumbers: effectiveSelectedInstallmentNumbers,
        balanceDue: summary.balanceDue,
        depositDue: summary.depositPaid ? 0 : summary.chargeAmount,
        upcomingInstallments,
      }),
    [
      effectiveSelectedInstallmentNumbers,
      summary.balanceDue,
      summary.chargeAmount,
      summary.depositPaid,
      upcomingInstallments,
    ],
  );

  const hasInstallmentPlan = upcomingInstallments.length > 0;
  const amountValid = isValidInvoicePaymentAmount({
    amount: selectedAmount,
    balanceDue: summary.balanceDue,
    depositPaid: summary.depositPaid,
    hasInstallmentPlan,
    effectiveInstallmentCount: effectiveSelectedInstallmentNumbers.length,
  });

  const remainderInstallmentNumbers = useMemo(
    () =>
      mapToRemainderInstallmentNumbers(
        summary.amortizationRows,
        effectiveSelectedInstallmentNumbers,
      ),
    [summary.amortizationRows, effectiveSelectedInstallmentNumbers],
  );

  const previewDueDatesByInstallmentNumber = useMemo(() => {
    if (!remainderInstallmentNumbers.length) return undefined;
    const rows = previewRemainderScheduleAfterPayments({
      total: summary.total,
      upfrontPercent: summary.upfrontPercent,
      config: summary.remainderSchedule,
      invoiceDueDate: summary.dueDate,
      issueDate: summary.issueDate,
      payingInstallmentNumbers: remainderInstallmentNumbers,
    });
    return Object.fromEntries(
      rows.map((row) => [row.installment_number, row.due_date]),
    );
  }, [
    remainderInstallmentNumbers,
    summary.remainderSchedule,
    summary.total,
    summary.upfrontPercent,
    summary.dueDate,
    summary.issueDate,
  ]);

  return {
    selectedInstallmentNumbers,
    effectiveSelectedInstallmentNumbers,
    toggleInstallment,
    selectAllInstallments,
    clearSelectedInstallments: () =>
      setSelectedInstallmentNumbers(defaultSelection),
    selectedAmount,
    amountValid,
    upcomingInstallments,
    hasInstallmentPlan,
    remainderInstallmentNumbers,
    previewDueDatesByInstallmentNumber,
  };
};

type PaymentCheckoutSession = {
  paymentIntentId: string;
  clientSecret: string;
  billingMode: string;
  stripePublishableKey?: string | null;
};

const useStablePaymentCheckoutSession = (
  token: string,
  summary: InvoicePaymentSummary,
  paymentAmountState: ReturnType<typeof useInvoicePaymentAmountState>,
  onAlreadyPaid?: () => void,
) => {
  const [session, setSession] = useState<PaymentCheckoutSession | null>(null);
  const [initialError, setInitialError] = useState<Error | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const lastSyncedRef = useRef("");
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const initialPreparedRef = useRef(false);
  const prepareInFlightRef = useRef<Promise<unknown> | null>(null);
  const onAlreadyPaidRef = useRef(onAlreadyPaid);
  onAlreadyPaidRef.current = onAlreadyPaid;

  const selectedAmount = paymentAmountState.selectedAmount;
  const remainderKey = paymentAmountState.remainderInstallmentNumbers.join(",");
  const syncKey = `${selectedAmount}|${remainderKey}`;

  const paymentStateRef = useRef({
    selectedAmount,
    remainderInstallmentNumbers: paymentAmountState.remainderInstallmentNumbers,
  });
  paymentStateRef.current = {
    selectedAmount,
    remainderInstallmentNumbers: paymentAmountState.remainderInstallmentNumbers,
  };

  const runPrepare = useCallback(
    async (paymentIntentId?: string) => {
      const execute = async () => {
        const storedPaymentIntentId =
          paymentIntentId ??
          readStoredInvoicePaymentIntentId(token) ??
          undefined;

        const result = await preparePublicClientInvoicePayment({
          token,
          amount: paymentStateRef.current.selectedAmount,
          remainderInstallmentNumbers:
            paymentStateRef.current.remainderInstallmentNumbers,
          paymentIntentId: storedPaymentIntentId,
        });

        if (result.billing_mode === "mock" || result.billing_mode === "manual") {
          clearStoredInvoicePaymentIntentId(token);
          setSession({
            paymentIntentId: "",
            clientSecret: "",
            billingMode: result.billing_mode,
          });
          return result;
        }

        if (result.payment_intent_id && result.client_secret) {
          writeStoredInvoicePaymentIntentId(token, result.payment_intent_id);
          setSession({
            paymentIntentId: result.payment_intent_id,
            clientSecret: result.client_secret,
            billingMode: result.billing_mode ?? "stripe",
            stripePublishableKey: result.stripe_publishable_key ?? null,
          });
        }

        return result;
      };

      if (prepareInFlightRef.current) {
        await prepareInFlightRef.current;
      }

      const promise = execute();
      prepareInFlightRef.current = promise.finally(() => {
        if (prepareInFlightRef.current === promise) {
          prepareInFlightRef.current = null;
        }
      });
      return promise;
    },
    [token],
  );

  useEffect(() => {
    setSession(null);
    lastSyncedRef.current = "";
    initialPreparedRef.current = false;
  }, [token]);

  useEffect(() => {
    if (summary.isPaid) {
      clearStoredInvoicePaymentIntentId(token);
    }
  }, [summary.isPaid, token]);

  useEffect(() => {
    if (summary.isPaid || !paymentAmountState.amountValid) {
      setIsInitialLoading(false);
      return;
    }
    if (initialPreparedRef.current) return;

    let cancelled = false;
    setIsInitialLoading(true);
    setInitialError(null);

    runPrepare()
      .then(() => {
        if (!cancelled) {
          lastSyncedRef.current = syncKey;
          initialPreparedRef.current = true;
        }
      })
      .catch((error: Error) => {
        if (cancelled) return;
        if (isPublicInvoiceAlreadyPaidError(error)) {
          clearStoredInvoicePaymentIntentId(token);
          onAlreadyPaidRef.current?.();
          return;
        }
        setInitialError(error);
      })
      .finally(() => {
        if (!cancelled) setIsInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, summary.isPaid, paymentAmountState.amountValid, runPrepare, syncKey]);

  useEffect(() => {
    if (isInitialLoading || !session?.paymentIntentId || summary.isPaid) return;
    if (syncKey === lastSyncedRef.current) return;

    const timer = window.setTimeout(() => {
      const promise = runPrepare(session.paymentIntentId)
        .then(() => {
          lastSyncedRef.current = syncKey;
          setSyncError(null);
        })
        .catch((error: Error) => {
          if (isPublicInvoiceAlreadyPaidError(error)) {
            clearStoredInvoicePaymentIntentId(token);
            onAlreadyPaidRef.current?.();
            return;
          }
          setSyncError(error);
        });
      syncPromiseRef.current = promise.then(() => undefined);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    syncKey,
    isInitialLoading,
    session?.paymentIntentId,
    summary.isPaid,
    runPrepare,
  ]);

  const ensureSynced = useCallback(async () => {
    if (summary.isPaid || !paymentAmountState.amountValid) return;
    if (syncPromiseRef.current) {
      await syncPromiseRef.current;
    }
    if (syncKey === lastSyncedRef.current) return;
    try {
      await runPrepare(session?.paymentIntentId || undefined);
      lastSyncedRef.current = syncKey;
    } catch (error) {
      if (isPublicInvoiceAlreadyPaidError(error)) {
        clearStoredInvoicePaymentIntentId(token);
        onAlreadyPaidRef.current?.();
        return;
      }
      throw error;
    }
  }, [
    summary.isPaid,
    paymentAmountState.amountValid,
    syncKey,
    runPrepare,
    session?.paymentIntentId,
    token,
  ]);

  return { session, isInitialLoading, initialError, syncError, ensureSynced };
};

const FocusPaymentEntryLayout = ({
  summary,
  payment,
}: {
  summary: ReactNode;
  payment: ReactNode;
}) => (
  <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-stretch">
    <div className="min-w-0 lg:border-r lg:border-border/50">{summary}</div>
    <div className="flex min-w-0 flex-col lg:justify-center">{payment}</div>
  </div>
);

const isDepositPaymentSchedule = (
  rows: InvoicePaymentSummary["scheduleRows"],
) =>
  rows.some(
    (row) =>
      row.key === "deposit" ||
      row.key === "remainder" ||
      row.key.startsWith("remainder-"),
  );

const FocusPaymentInvoiceColumn = ({
  payload,
  summary,
}: {
  payload: PublicInvoicePayload;
  summary: InvoicePaymentSummary;
}) => (
  <>
    <PublicInvoicePaymentSummary
      payload={payload}
      balanceDue={summary.balanceDue}
      balanceDueFormatted={summary.balanceDueFormatted}
    />
    {isDepositPaymentSchedule(summary.scheduleRows) ? (
      <div className="border-t border-border/50 px-4 py-4 sm:px-6">
        <InvoicePaymentSchedulePanel
          rows={summary.scheduleRows}
          currency={summary.currency}
          title="What you'll pay"
          description="Today's charge, then automatic payments on the dates below."
        />
      </div>
    ) : null}
  </>
);

const InvoicePaymentReviewActions = ({
  summary,
  paymentAmountState,
  consent,
  onConsentChange,
  paymentReady,
  paymentError,
  flowError,
  canPay,
  isPending,
  onPay,
  focusPaymentEntry = false,
  sheetLayout = false,
}: {
  summary: InvoicePaymentSummary;
  paymentAmountState: ReturnType<typeof useInvoicePaymentAmountState>;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  paymentReady: boolean;
  paymentError: string | null;
  flowError: string | null;
  canPay: boolean;
  isPending: boolean;
  onPay: () => void;
  focusPaymentEntry?: boolean;
  sheetLayout?: boolean;
}) => {
  const {
    currency,
    balanceDue,
    autoChargeRemainder,
    saveCardForFutureCharges,
  } = summary;
  const {
    effectiveSelectedInstallmentNumbers,
    selectedAmount,
    amountValid,
    upcomingInstallments,
  } = paymentAmountState;

  const selectedFormatted = formatMoney(selectedAmount, currency);

  const consentLabel = invoicePaymentConsentLabelForAmount({
    chargeAmount: selectedAmount,
    balanceDue,
    depositPaid: summary.depositPaid,
    autoChargeRemainder,
    saveCardForFutureCharges,
    selectedInstallmentCount: effectiveSelectedInstallmentNumbers.length,
    hasUpcomingAutoInstallments: upcomingInstallments.length > 0,
  });

  const focusLabels = focusPaymentEntry
    ? resolveFocusPaymentEntryLabels(summary, selectedAmount, currency)
    : null;

  return (
    <div
      className={cn(
        "space-y-3",
        sheetLayout
          ? "sticky bottom-0 z-10 border-t border-border/50 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_20px_rgba(15,23,42,0.06)]"
          : focusPaymentEntry
            ? "px-4 pb-5 pt-1 sm:px-6"
            : `${publicInvoicePaymentSectionPadding} pb-6 pt-2`,
      )}
    >
      {!focusPaymentEntry ? (
        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(checked) => onConsentChange(checked === true)}
            className="mt-0.5 shrink-0"
          />
          <span>{consentLabel}</span>
        </label>
      ) : null}

      {paymentError ? (
        <p className="text-sm text-destructive">{paymentError}</p>
      ) : null}

      {flowError ? (
        <p className="text-sm text-destructive">{flowError}</p>
      ) : null}

      {focusLabels?.footnote ? (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {focusLabels.footnote}
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={!canPay || isPending || !amountValid}
        isLoading={isPending}
        onClick={onPay}
        className={cn(
          "w-full rounded-xl text-base",
          focusPaymentEntry ? "py-3.5" : "py-4",
        )}
      >
        {isPending
          ? (focusLabels?.pendingLabel ?? "Processing…")
          : focusLabels
            ? focusLabels.submitLabel
            : `Pay ${selectedFormatted}`}
      </Button>

      {!focusPaymentEntry ? (
        <p className="text-center text-xs text-muted-foreground">
          <Lock className="mr-1 inline size-3.5 align-text-bottom" />
          Secure payment · Apple Pay, Google Pay, and cards accepted
        </p>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground">
          <Lock className="mr-1 inline size-3 align-text-bottom" />
          Secured by Stripe
        </p>
      )}
    </div>
  );
};

const InvoiceStripePaymentFormInner = ({
  token,
  payload,
  paymentIntentId,
  chargeAmount,
  remainderInstallmentNumbers,
  summary,
  paymentAmountState,
  ensureSynced,
  onSuccess,
  focusPaymentEntry = false,
  sheetLayout = false,
}: PaymentFlowProps & {
  paymentIntentId: string;
  chargeAmount: number;
  remainderInstallmentNumbers: number[];
  summary: InvoicePaymentSummary;
  paymentAmountState: ReturnType<typeof useInvoicePaymentAmountState>;
  ensureSynced: () => Promise<void>;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [consent, setConsent] = useState(focusPaymentEntry);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  useEffect(() => {
    elements?.fetchUpdates().catch(() => {});
  }, [chargeAmount, elements]);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) {
        throw new Error("Payment options are not ready yet");
      }

      await ensureSynced();

      const returnUrl = `${window.location.origin}${window.location.pathname}`;

      const { error: confirmError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: "if_required",
        });

      if (confirmError) {
        throw new Error(
          confirmError.message ?? "Payment could not be completed",
        );
      }

      const completedIntentId = paymentIntent?.id ?? paymentIntentId;
      if (
        paymentIntent?.status &&
        paymentIntent.status !== "succeeded" &&
        paymentIntent.status !== "processing"
      ) {
        throw new Error("Payment could not be completed");
      }

      return payPublicClientInvoice({
        token,
        paymentIntentId: completedIntentId,
        amount: chargeAmount,
        remainderInstallmentNumbers,
      });
    },
    onSuccess: () => {
      setFlowError(null);
      onSuccess();
    },
    onError: (error: Error) => setFlowError(error.message),
  });

  const canPay =
    (focusPaymentEntry || consent) &&
    paymentReady &&
    !paymentError &&
    summary.balanceDue > 0 &&
    !summary.isPaid &&
    paymentAmountState.amountValid;

  return (
    <>
      {focusPaymentEntry ? (
        <FocusPaymentEntryLayout
          summary={
            <FocusPaymentInvoiceColumn payload={payload} summary={summary} />
          }
          payment={
            <>
              <div className="px-4 pb-1 pt-4 sm:px-6 lg:pt-6">
                <PublicInvoicePaymentCardHeading />
                <PaymentElement
                  options={cardOnlyPaymentElementOptions}
                  onChange={(event: StripePaymentElementChangeEvent) => {
                    setPaymentReady(event.complete);
                    setPaymentError(event.error?.message ?? null);
                  }}
                />
              </div>
              <InvoicePaymentReviewActions
                summary={summary}
                paymentAmountState={paymentAmountState}
                consent={consent}
                onConsentChange={setConsent}
                paymentReady={paymentReady}
                paymentError={paymentError}
                flowError={flowError}
                canPay={canPay}
                isPending={payMutation.isPending}
                onPay={() => payMutation.mutate()}
                focusPaymentEntry={focusPaymentEntry}
                sheetLayout={sheetLayout}
              />
            </>
          }
        />
      ) : (
        <>
          <div
            className={cn(
              `${publicInvoicePaymentSectionPadding} pb-1 pt-4`,
              sheetLayout && "pb-4",
            )}
          >
            <p className="mb-2 text-[13px] text-muted-foreground">
              Payment method
            </p>
            <PaymentElement
              options={paymentElementOptions}
              onChange={(event: StripePaymentElementChangeEvent) => {
                setPaymentReady(event.complete);
                setPaymentError(event.error?.message ?? null);
              }}
            />
          </div>

          <InvoicePaymentReviewActions
            summary={summary}
            paymentAmountState={paymentAmountState}
            consent={consent}
            onConsentChange={setConsent}
            paymentReady={paymentReady}
            paymentError={paymentError}
            flowError={flowError}
            canPay={canPay}
            isPending={payMutation.isPending}
            onPay={() => payMutation.mutate()}
            focusPaymentEntry={focusPaymentEntry}
            sheetLayout={sheetLayout}
          />
        </>
      )}
    </>
  );
};

const InvoiceStripeCheckout = ({
  token,
  payload,
  onSuccess,
  focusPaymentEntry = false,
  sheetLayout = false,
}: PaymentFlowProps) => {
  const [flowError, setFlowError] = useState<string | null>(null);
  const [finalizingRedirect, setFinalizingRedirect] = useState(false);
  const summary = useMemo(() => buildPaymentSummary(payload), [payload]);
  const paymentAmountState = useInvoicePaymentAmountState(summary);
  const checkout = useStablePaymentCheckoutSession(
    token,
    summary,
    paymentAmountState,
    onSuccess,
  );
  const { invoice } = payload;
  const publishableKey = resolveStripePublishableKey(
    payload,
    checkout.session?.stripePublishableKey,
  );
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");
    if (
      !paymentIntentId ||
      redirectStatus !== "succeeded" ||
      finalizingRedirect
    ) {
      return;
    }

    setFinalizingRedirect(true);
    payPublicClientInvoice({ token, paymentIntentId })
      .then(() => {
        window.history.replaceState({}, "", window.location.pathname);
        onSuccess();
      })
      .catch((error: Error) => {
        setFlowError(error.message);
        setFinalizingRedirect(false);
      });
  }, [token, onSuccess, finalizingRedirect]);

  if (summary.isPaid) {
    return (
      <p className="mx-auto max-w-[560px] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        This invoice is paid in full. Thank you.
      </p>
    );
  }

  if (finalizingRedirect) {
    return (
      <div className="mx-auto flex max-w-[560px] items-center justify-center gap-2 rounded-[14px] border border-border/60 bg-background px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Confirming your payment…
      </div>
    );
  }

  const clientSecret = checkout.session?.clientSecret ?? null;
  const paymentIntentId = checkout.session?.paymentIntentId ?? null;

  const shellClass = sheetLayout
    ? "w-full"
    : focusPaymentEntry
      ? focusPaymentEntryShellClass
      : publicInvoicePaymentShellClass;

  return (
    <div className={shellClass}>
      {!focusPaymentEntry ? (
        <div
          className={`flex flex-col gap-2 border-b border-border/40 ${publicInvoicePaymentSectionPadding} pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5 sm:pt-6`}
        >
          <div className="min-w-0">
            <p className="mb-1 text-[13px] text-muted-foreground">
              Balance due
            </p>
            <p className="text-[26px] font-medium tabular-nums leading-none text-foreground sm:text-[30px]">
              {summary.balanceDueFormatted}
            </p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="mb-1 text-[13px] text-muted-foreground">Invoice</p>
            <p className="text-sm font-medium text-foreground">
              {invoice.invoice_number}
            </p>
          </div>
        </div>
      ) : null}

      {!focusPaymentEntry ? (
        <InvoicePaymentAmountPicker
          balanceDue={summary.balanceDue}
          depositDue={summary.chargeAmount}
          upfrontPercent={summary.upfrontPercent}
          autoChargeRemainder={summary.autoChargeRemainder}
          saveCardForFutureCharges={summary.saveCardForFutureCharges}
          depositPaid={summary.depositPaid}
          remainderSchedule={summary.remainderSchedule}
          amortizationRows={summary.amortizationRows}
          currency={summary.currency}
          selectedInstallmentNumbers={
            paymentAmountState.selectedInstallmentNumbers.length > 0
              ? paymentAmountState.selectedInstallmentNumbers
              : paymentAmountState.effectiveSelectedInstallmentNumbers
          }
          onToggleInstallment={paymentAmountState.toggleInstallment}
          onSelectAllInstallments={paymentAmountState.selectAllInstallments}
          onClearSelectedInstallments={
            paymentAmountState.clearSelectedInstallments
          }
          previewDueDatesByInstallmentNumber={
            paymentAmountState.previewDueDatesByInstallmentNumber
          }
        />
      ) : null}

      {checkout.isInitialLoading ? (
        <div
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground",
            focusPaymentEntry
              ? "justify-center px-4 py-8 sm:px-6"
              : `${publicInvoicePaymentSectionPadding} py-4`,
          )}
        >
          <Loader2 className="size-4 animate-spin" />
          {focusPaymentEntry
            ? "Loading invoice…"
            : "Loading payment options…"}
        </div>
      ) : checkout.initialError ? (
        <p
          className={`${publicInvoicePaymentSectionPadding} pb-4 text-sm text-destructive`}
        >
          {checkout.initialError.message}
        </p>
      ) : checkout.syncError ? (
        <p
          className={`${publicInvoicePaymentSectionPadding} pb-4 text-sm text-destructive`}
        >
          {checkout.syncError.message}
        </p>
      ) : checkout.session?.billingMode === "mock" ||
        checkout.session?.billingMode === "manual" ||
        !clientSecret ? (
        <p
          className={`${publicInvoicePaymentSectionPadding} pb-4 text-sm text-warning`}
        >
          {checkout.session?.billingMode === "manual"
            ? "Online card payment is not available for this invoice. Contact the office to pay."
            : "Stripe is not configured. Add keys under Settings → Integrations → Stripe."}
        </p>
      ) : clientSecret && paymentIntentId && stripePromise ? (
        <Elements
          key={paymentIntentId}
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: stripeElementsAppearance,
          }}
        >
          <InvoiceStripePaymentFormInner
            token={token}
            payload={payload}
            onSuccess={onSuccess}
            focusPaymentEntry={focusPaymentEntry}
            sheetLayout={sheetLayout}
            paymentIntentId={paymentIntentId}
            chargeAmount={paymentAmountState.selectedAmount}
            remainderInstallmentNumbers={
              paymentAmountState.remainderInstallmentNumbers
            }
            summary={summary}
            paymentAmountState={paymentAmountState}
            ensureSynced={checkout.ensureSynced}
          />
        </Elements>
      ) : flowError ? (
        <p
          className={`${publicInvoicePaymentSectionPadding} pb-4 text-sm text-destructive`}
        >
          {flowError}
        </p>
      ) : null}
    </div>
  );
};

const InvoiceMockPaymentForm = ({
  token,
  payload,
  onSuccess,
  focusPaymentEntry = false,
  sheetLayout = false,
}: PaymentFlowProps) => {
  const [consent, setConsent] = useState(focusPaymentEntry);
  const [flowError, setFlowError] = useState<string | null>(null);
  const summary = useMemo(() => buildPaymentSummary(payload), [payload]);
  const paymentAmountState = useInvoicePaymentAmountState(summary);
  const { invoice } = payload;

  const payMutation = useMutation({
    mutationFn: () =>
      payPublicClientInvoice({
        token,
        amount: paymentAmountState.selectedAmount,
        remainderInstallmentNumbers:
          paymentAmountState.remainderInstallmentNumbers,
      }),
    onSuccess: () => {
      setFlowError(null);
      onSuccess();
    },
    onError: (error: Error) => setFlowError(error.message),
  });

  const canContinue =
    (focusPaymentEntry || consent) &&
    summary.balanceDue > 0 &&
    !summary.isPaid &&
    paymentAmountState.amountValid;

  if (summary.isPaid) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        This invoice is paid in full. Thank you.
      </p>
    );
  }

  if (focusPaymentEntry) {
    return (
      <div className={focusPaymentEntryShellClass}>
        <FocusPaymentEntryLayout
          summary={
            <FocusPaymentInvoiceColumn payload={payload} summary={summary} />
          }
          payment={
            <>
              <div className="px-4 pb-1 pt-4 sm:px-6 lg:pt-6">
                <PublicInvoicePaymentCardHeading />
                <p className="text-sm text-muted-foreground">
                  Demo mode · No card required
                </p>
              </div>
              <InvoicePaymentReviewActions
                summary={summary}
                paymentAmountState={paymentAmountState}
                consent={consent}
                onConsentChange={setConsent}
                paymentReady
                paymentError={null}
                flowError={flowError}
                canPay={canContinue}
                isPending={payMutation.isPending}
                onPay={() => payMutation.mutate()}
                focusPaymentEntry
              />
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className={sheetLayout ? "w-full" : publicInvoicePaymentShellClass}>
      <div
        className={`flex flex-col gap-2 border-b border-border/40 ${publicInvoicePaymentSectionPadding} pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5 sm:pt-6`}
      >
        <div className="min-w-0">
          <p className="mb-1 text-[13px] text-muted-foreground">Balance due</p>
          <p className="text-[26px] font-medium tabular-nums leading-none text-foreground sm:text-[30px]">
            {summary.balanceDueFormatted}
          </p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="mb-1 text-[13px] text-muted-foreground">Invoice</p>
          <p className="text-sm font-medium text-foreground">
            {invoice.invoice_number}
          </p>
        </div>
      </div>

      <InvoicePaymentAmountPicker
        balanceDue={summary.balanceDue}
        depositDue={summary.chargeAmount}
        upfrontPercent={summary.upfrontPercent}
        autoChargeRemainder={summary.autoChargeRemainder}
        saveCardForFutureCharges={summary.saveCardForFutureCharges}
        depositPaid={summary.depositPaid}
        remainderSchedule={summary.remainderSchedule}
        amortizationRows={summary.amortizationRows}
        currency={summary.currency}
        selectedInstallmentNumbers={
          paymentAmountState.selectedInstallmentNumbers.length > 0
            ? paymentAmountState.selectedInstallmentNumbers
            : paymentAmountState.effectiveSelectedInstallmentNumbers
        }
        onToggleInstallment={paymentAmountState.toggleInstallment}
        onSelectAllInstallments={paymentAmountState.selectAllInstallments}
        onClearSelectedInstallments={
          paymentAmountState.clearSelectedInstallments
        }
        previewDueDatesByInstallmentNumber={
          paymentAmountState.previewDueDatesByInstallmentNumber
        }
      />

      <InvoicePaymentReviewActions
        summary={summary}
        paymentAmountState={paymentAmountState}
        consent={consent}
        onConsentChange={setConsent}
        paymentReady
        paymentError={null}
        flowError={flowError}
        canPay={canContinue}
        isPending={payMutation.isPending}
        onPay={() => payMutation.mutate()}
        sheetLayout={sheetLayout}
      />

      {!sheetLayout ? (
        <p
          className={`-mt-2 pb-6 text-center text-xs text-muted-foreground ${publicInvoicePaymentSectionPadding}`}
        >
          Demo mode · No card required
        </p>
      ) : null}
    </div>
  );
};

export const PublicInvoicePaymentFlow = (props: PaymentFlowProps) => {
  const billingSkipped = isClientBillingSkipped();
  const cardPaymentsLive = props.payload.client_billing_mode === "stripe";
  const publishableKey = resolveStripePublishableKey(props.payload);
  const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
  const useStripeElements =
    Boolean(stripePromise) && !billingSkipped && cardPaymentsLive;

  if (!billingSkipped && !cardPaymentsLive) {
    return (
      <div
        className={`mx-auto max-w-[560px] rounded-[14px] border border-amber-200 bg-amber-50 ${publicInvoicePaymentSectionPadding} py-5 text-sm text-amber-900`}
      >
        Online card payment is not available for this invoice. Contact the office
        to pay.
      </div>
    );
  }

  if (!stripePromise && !billingSkipped) {
    return (
      <div
        className={`mx-auto max-w-[560px] rounded-[14px] border border-amber-200 bg-amber-50 ${publicInvoicePaymentSectionPadding} py-5 text-sm text-amber-900`}
      >
        Card payments are not configured. Add Stripe keys under Settings →
        Integrations → Stripe, or set{" "}
        <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> on the
        server build.
      </div>
    );
  }

  if (!useStripeElements) {
    return <InvoiceMockPaymentForm {...props} />;
  }

  return <InvoiceStripeCheckout {...props} />;
};
