import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeCardElementChangeEvent } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import { parseInvoiceRemainderSchedule } from "@/lbs/billing/invoiceRemainderSchedule";
import {
  buildInvoiceAmortizationSchedule,
  buildInvoicePaymentSchedule,
  computeInvoiceUpfrontAmount,
  computeInvoiceBalanceDue,
} from "@/lbs/billing/invoicePaymentUtils";
import {
  InvoicePortalPaymentScheduleTable,
  invoicePaymentConsentLabel,
} from "@/lbs/billing/InvoicePortalPaymentScheduleTable";
import {
  payPublicClientInvoice,
  type PublicInvoicePayload,
} from "@/lbs/billing/public/publicInvoiceApi";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: { color: "#dc2626" },
  },
};

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

type PaymentFlowProps = {
  token: string;
  payload: PublicInvoicePayload;
  onSuccess: () => void;
};

type InvoicePaymentSummary = {
  currency: string;
  balanceDue: number;
  balanceDueFormatted: string;
  chargeAmount: number;
  chargeFormatted: string;
  upfrontPercent: number;
  remainderDue: number;
  scheduleRows: ReturnType<typeof buildInvoicePaymentSchedule>;
  amortizationRows: ReturnType<typeof buildInvoiceAmortizationSchedule>;
  isDepositPlan: boolean;
  isPaid: boolean;
};

const buildPaymentSummary = (payload: PublicInvoicePayload): InvoicePaymentSummary => {
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
  const scheduleParams = {
    total,
    amountPaid,
    upfrontPercent,
    autoChargeRemainder: invoice.auto_charge_remainder,
    saveCard: invoice.save_card_for_future_charges,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
    remainderSchedule: parseInvoiceRemainderSchedule(
      invoice.remainder_schedule,
      invoice.due_date,
    ),
  };
  const scheduleRows = buildInvoicePaymentSchedule(scheduleParams);
  const amortizationRows = buildInvoiceAmortizationSchedule(scheduleParams);
  const isDepositPlan = scheduleRows.some(
    (row) => row.key === "deposit" || row.key.startsWith("remainder"),
  );

  return {
    currency,
    balanceDue,
    balanceDueFormatted: formatMoney(balanceDue, currency),
    chargeAmount,
    chargeFormatted: formatMoney(chargeAmount || balanceDue, currency),
    upfrontPercent,
    remainderDue: Math.max(balanceDue - chargeAmount, 0),
    scheduleRows,
    amortizationRows,
    isDepositPlan,
    isPaid: invoice.status === "paid" || balanceDue <= 0,
  };
};

const InvoicePaymentFormBody = ({
  payload,
  summary,
  stripeCheckoutEnabled,
  consent,
  onConsentChange,
  cardComplete,
  cardError,
  onCardChange,
  flowError,
  canPay,
  isPending,
  onPay,
}: {
  payload: PublicInvoicePayload;
  summary: InvoicePaymentSummary;
  stripeCheckoutEnabled: boolean;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  cardComplete: boolean;
  cardError: string | null;
  onCardChange: (event: StripeCardElementChangeEvent) => void;
  flowError: string | null;
  canPay: boolean;
  isPending: boolean;
  onPay: () => void;
}) => {
  const { invoice } = payload;
  const {
    currency,
    balanceDue,
    balanceDueFormatted,
    chargeAmount,
    chargeFormatted,
    scheduleRows,
    amortizationRows,
    isDepositPlan,
    isPaid,
  } = summary;

  if (isPaid) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        This invoice is paid in full. Thank you.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Amount due</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {balanceDueFormatted}
        </p>
      </div>

      <InvoicePortalPaymentScheduleTable
        rows={amortizationRows}
        currency={currency}
        totalDue={balanceDue}
        dueToday={chargeAmount}
      />

      {!isDepositPlan ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Full invoice balance due in one payment. The amount cannot be changed.
        </div>
      ) : null}

      {stripeCheckoutEnabled ? (
        <div className="space-y-3 rounded-lg border p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Card details
          </Label>
          <div className="rounded-md border bg-background px-3 py-3">
            <CardElement options={cardElementOptions} onChange={onCardChange} />
          </div>
          {cardError ? (
            <p className="text-sm text-destructive">{cardError}</p>
          ) : null}
          {invoice.save_card_for_future_charges ? (
            <p className="text-xs text-muted-foreground">
              Your card will be saved for any remaining balance or future invoices.
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            Secure payment processed by Stripe
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Billing is in demo mode — no card required.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
        />
        <span>{invoicePaymentConsentLabel(amortizationRows)}</span>
      </label>

      {flowError ? (
        <p className="text-sm text-destructive">{flowError}</p>
      ) : null}

      <Button
        type="button"
        className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
        size="lg"
        disabled={!canPay || isPending}
        onClick={onPay}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {isPending ? "Processing…" : isDepositPlan ? `Pay ${chargeFormatted} now` : `Pay ${chargeFormatted}`}
      </Button>
    </div>
  );
};

const InvoiceMockPaymentForm = ({ token, payload, onSuccess }: PaymentFlowProps) => {
  const [consent, setConsent] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const summary = buildPaymentSummary(payload);

  const payMutation = useMutation({
    mutationFn: () => payPublicClientInvoice({ token }),
    onSuccess: () => {
      setFlowError(null);
      onSuccess();
    },
    onError: (error: Error) => setFlowError(error.message),
  });

  const canPay = consent && summary.balanceDue > 0 && !summary.isPaid;

  return (
    <InvoicePaymentFormBody
      payload={payload}
      summary={summary}
      stripeCheckoutEnabled={false}
      consent={consent}
      onConsentChange={setConsent}
      cardComplete
      cardError={null}
      onCardChange={() => undefined}
      flowError={flowError}
      canPay={canPay}
      isPending={payMutation.isPending}
      onPay={() => payMutation.mutate()}
    />
  );
};

const InvoiceStripePaymentForm = ({ token, payload, onSuccess }: PaymentFlowProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [consent, setConsent] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const summary = buildPaymentSummary(payload);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) {
        throw new Error("Card payments are not configured");
      }

      const card = elements.getElement(CardElement);
      if (!card) {
        throw new Error("Enter your card details");
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card,
      });

      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? "Could not read card");
      }

      return payPublicClientInvoice({
        token,
        paymentMethodId: paymentMethod.id,
      });
    },
    onSuccess: () => {
      setFlowError(null);
      onSuccess();
    },
    onError: (error: Error) => setFlowError(error.message),
  });

  const canPay =
    consent &&
    cardComplete &&
    !cardError &&
    summary.balanceDue > 0 &&
    !summary.isPaid;

  return (
    <InvoicePaymentFormBody
      payload={payload}
      summary={summary}
      stripeCheckoutEnabled
      consent={consent}
      onConsentChange={setConsent}
      cardComplete={cardComplete}
      cardError={cardError}
      onCardChange={(event) => {
        setCardComplete(event.complete);
        setCardError(event.error?.message ?? null);
      }}
      flowError={flowError}
      canPay={canPay}
      isPending={payMutation.isPending}
      onPay={() => payMutation.mutate()}
    />
  );
};

export const PublicInvoicePaymentFlow = (props: PaymentFlowProps) => {
  const stripeMock = isClientBillingSkipped();
  const useStripeElements = !stripeMock && Boolean(stripePromise);

  if (!useStripeElements) {
    return <InvoiceMockPaymentForm {...props} />;
  }

  return (
    <Elements stripe={stripePromise}>
      <InvoiceStripePaymentForm {...props} />
    </Elements>
  );
};
