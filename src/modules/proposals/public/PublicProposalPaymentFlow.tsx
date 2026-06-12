import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeCardElementChangeEvent } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isClientBillingSkipped } from "@/modules/billing/clientBillingProvider";
import type { ProposalLocale } from "@/modules/proposals/document/proposalDocumentI18n";
import { formatProposalMoney } from "@/modules/proposals/document/useProposalDocumentData";
import { getProposalPaymentFlowCopy } from "@/modules/proposals/public/proposalPaymentFlowI18n";
import {
  payPublicProposalDeposit,
  type PublicProposalPayload,
} from "@/modules/proposals/public/publicProposalApi";

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

type PaymentFlowProps = {
  proposalId: number;
  token: string;
  payload: PublicProposalPayload;
  locale: ProposalLocale;
  onSuccess: () => void;
  onMockPay: () => void;
  mockPayPending: boolean;
};

const DepositPaymentForm = ({
  proposalId,
  token,
  payload,
  locale,
  onSuccess,
  onMockPay,
  mockPayPending,
}: PaymentFlowProps) => {
  const copy = getProposalPaymentFlowCopy(locale);
  const stripe = useStripe();
  const elements = useElements();
  const [consent, setConsent] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const { proposal, installments, contract } = payload;
  const currency = proposal.currency ?? "USD";
  const stripeMock = isClientBillingSkipped();
  const billingMode = payload.client_billing_mode ?? "manual";
  const useStripe =
    !stripeMock && billingMode === "stripe" && Boolean(stripePromise);

  const depositInstallment = installments.find((row) =>
    row.label.toLowerCase().includes("deposit"),
  );
  const balanceInstallments = installments.filter(
    (row) => !row.label.toLowerCase().includes("deposit"),
  );
  const depositAmount = depositInstallment?.amount ?? proposal.deposit_amount ?? 0;
  const depositFormatted = formatProposalMoney(depositAmount, currency);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!useStripe) {
        onMockPay();
        return { billing_mode: "mock" as const, paid_in_full: false };
      }
      if (!stripe || !elements) {
        throw new Error(copy.stripeNotConfigured);
      }

      const card = elements.getElement(CardElement);
      if (!card) {
        throw new Error(copy.cardError);
      }

      const { error: pmError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
          card,
        });

      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? copy.cardError);
      }

      const result = await payPublicProposalDeposit({
        proposalId,
        token,
        paymentMethodId: paymentMethod.id,
      });

      if (result.requires_action && result.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(
          result.client_secret,
        );
        if (confirmError) {
          throw new Error(confirmError.message ?? copy.authenticateHint);
        }
      }

      return result;
    },
    onSuccess: () => {
      setFlowError(null);
      onSuccess();
    },
    onError: (error: Error) => setFlowError(error.message),
  });

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardComplete(event.complete);
    setCardError(event.error?.message ?? null);
  };

  const canPay =
    consent &&
    (useStripe ? cardComplete && !cardError : true) &&
    Boolean(contract?.signed_at) &&
    !contract?.deposit_paid_at;

  return (
    <div className="space-y-4">
      {balanceInstallments.length > 0 ? (
        <ScheduleList
          installments={balanceInstallments}
          currency={currency}
          title={copy.scheduleTitle}
          intro={copy.scheduleIntro(balanceInstallments.length)}
        />
      ) : null}

      {useStripe ? (
        <div className="space-y-3 rounded-lg border p-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Card details
          </Label>
          <div className="rounded-md border bg-background px-3 py-3">
            <CardElement options={cardElementOptions} onChange={handleCardChange} />
          </div>
          {cardError ? (
            <p className="text-sm text-destructive">{cardError}</p>
          ) : null}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            Secure payment processed by Stripe
          </p>
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
        />
        <span>{copy.consentLabel}</span>
      </label>

      {flowError ? (
        <p className="text-sm text-destructive">{flowError}</p>
      ) : null}

      <Button
        type="button"
        className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
        size="lg"
        disabled={!canPay || payMutation.isPending || mockPayPending}
        onClick={() => payMutation.mutate()}
      >
        {payMutation.isPending || mockPayPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {payMutation.isPending || mockPayPending
          ? copy.processing
          : copy.payNow(depositFormatted)}
      </Button>
    </div>
  );
};

const ScheduleList = ({
  installments,
  currency,
  title,
  intro,
}: {
  installments: PublicProposalPayload["installments"];
  currency: string;
  title: string;
  intro: string;
}) => (
  <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
    <p className="font-medium">{title}</p>
    <p className="text-muted-foreground">{intro}</p>
    <ul className="space-y-1.5">
      {installments.map((row) => (
        <li
          key={`${row.installment_number}-${row.due_date}`}
          className="flex justify-between gap-2 tabular-nums"
        >
          <span>
            {row.label} — {row.due_date}
          </span>
          <span className="font-medium">
            {formatProposalMoney(row.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export const PublicProposalPaymentFlow = (props: PaymentFlowProps) => {
  const stripeMock = isClientBillingSkipped();
  const billingMode = props.payload.client_billing_mode ?? "manual";
  const useElements =
    !stripeMock && billingMode === "stripe" && stripePromise;

  if (!useElements) {
    return <DepositPaymentForm {...props} />;
  }

  return (
    <Elements stripe={stripePromise}>
      <DepositPaymentForm {...props} />
    </Elements>
  );
};
