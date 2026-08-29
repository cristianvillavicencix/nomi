import { useMemo } from "react";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import {
  formatSubscriptionAmountLabel,
  buildSubscriptionBankStatementPreview,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import {
  formatSubscriptionMoney,
  STRIPE_TRANSFER_FEE_LABEL,
  subscriptionChargeFromNet,
} from "@/modules/billing/subscriptions/subscriptionFeeUtils";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceOrganizationInfo";
import {
  formatSubscriptionScheduleLabel,
  subscriptionPaymentModeLabel,
  type SubscriptionPaymentMode,
} from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import {
  formatSavedCardLabel,
  savedCardSourceLabel,
  type ClientSavedPaymentMethod,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

type SubscriptionCreateReviewPanelProps = {
  clientLabel: string;
  subscriptionName: string;
  amount: number;
  billingInterval: "weekly" | "monthly" | "yearly";
  startsAtDate: string | null;
  endsAtDate: string | null;
  paymentMode: SubscriptionPaymentMode;
  cardOnFile?: {
    brand?: string | null;
    last4?: string | null;
  } | null;
  savedCards?: ClientSavedPaymentMethod[];
  recipientEmail: string;
  recipientPhone: string;
  sendEmail: boolean;
  sendSms: boolean;
  deliveryMessage: string;
  orgTitle: string;
  canSubmit: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  hideActions?: boolean;
  waitingForCard?: boolean;
};

const SummaryRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-[60%] text-right font-medium">{value}</span>
  </div>
);

export const SubscriptionCreateReviewPanel = ({
  clientLabel,
  subscriptionName,
  amount,
  billingInterval,
  startsAtDate,
  endsAtDate,
  paymentMode,
  cardOnFile,
  savedCards = [],
  recipientEmail,
  recipientPhone,
  sendEmail,
  sendSms,
  deliveryMessage,
  orgTitle,
  canSubmit,
  isPending,
  onSubmit,
  onCancel,
  submitLabel = "Create subscription",
  pendingLabel = "Creating…",
  hideActions = false,
  waitingForCard = false,
}: SubscriptionCreateReviewPanelProps) => {
  const schedule = formatSubscriptionScheduleLabel({
    startsAt: startsAtDate,
    endsAt: endsAtDate,
    billingInterval,
  });

  const charge = useMemo(() => subscriptionChargeFromNet(amount), [amount]);

  const amountLabel = formatSubscriptionAmountLabel(
    amount,
    "USD",
    billingInterval,
  );

  const totalChargeLabel = formatSubscriptionAmountLabel(
    charge.total,
    "USD",
    billingInterval,
  );

  const paymentLabel = useMemo(() => {
    if (paymentMode === "saved_card" && cardOnFile?.last4) {
      return `${cardOnFile.brand ?? "Card"} ····${cardOnFile.last4}`;
    }
    if (paymentMode === "staff_card") {
      return "New card (staff entry)";
    }
    return "Checkout link by email/SMS";
  }, [paymentMode, cardOnFile]);

  const bankStatementLabel = useMemo(() => {
    if (!subscriptionName.trim() || amount <= 0) return null;
    return buildSubscriptionBankStatementPreview({
      orgName: resolveInvoiceOrganizationName({ title: orgTitle }),
      subscriptionName,
    });
  }, [subscriptionName, amount, orgTitle]);

  const bankChargeAmount = formatSubscriptionMoney(charge.total);

  return (
    <div className="flex h-full min-h-[32rem] flex-col rounded-xl border bg-muted/15 p-5 md:sticky md:top-0">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Review
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {subscriptionName || "Subscription"}
        </h3>
      </div>

      {waitingForCard ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
          Waiting for the client to add a card. This screen will update when the
          card is saved — then you can activate the subscription.
        </div>
      ) : null}

      <div className="rounded-lg border bg-background px-4 py-1">
        <SummaryRow label="Client" value={clientLabel || "—"} />
        <SummaryRow label="Plan (net)" value={amountLabel} />
        <SummaryRow
          label={`Processing fee (${STRIPE_TRANSFER_FEE_LABEL})`}
          value={formatSubscriptionMoney(charge.feeAmount)}
        />
        <SummaryRow label="Client pays" value={totalChargeLabel} />
        <SummaryRow label="Starts" value={schedule.start} />
        <SummaryRow label="Ends" value={schedule.end} />
        <SummaryRow
          label="Payment"
          value={subscriptionPaymentModeLabel(paymentMode)}
        />
        <SummaryRow label="Card" value={paymentLabel} />
        {savedCards.length > 1 ? (
          <div className="border-b py-2 text-xs text-muted-foreground last:border-b-0">
            <p className="mb-1">Saved on file</p>
            <ul className="space-y-1">
              {savedCards.map((card) => (
                <li key={`${card.source}-${card.last4}`}>
                  {formatSavedCardLabel(card)} ·{" "}
                  {savedCardSourceLabel(card.source)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {bankStatementLabel ? (
        <div className="mt-4 min-w-0 rounded-lg border bg-background p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4 text-muted-foreground" />
            Bank statement
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium uppercase leading-snug">
                {bankStatementLabel}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-destructive">
                -{bankChargeAmount}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Approximate debit including processing fee. Banks may shorten or
              wrap the merchant name.
            </p>
          </div>
        </div>
      ) : null}

      {paymentMode === "request_setup" && (sendEmail || sendSms) ? (
        <div className="mt-4 min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {sendEmail && recipientEmail ? (
              <Badge variant="secondary">Email: {recipientEmail}</Badge>
            ) : null}
            {sendSms && recipientPhone ? (
              <Badge variant="secondary">SMS: {recipientPhone}</Badge>
            ) : null}
          </div>
          <InvoiceSendDeliveryPreview
            subject={`${orgTitle}: Set up ${subscriptionName}`}
            emailHtml={deliveryMessage.replace(/\n/g, "<br/>")}
            smsText={deliveryMessage}
            emailTo={recipientEmail}
            smsTo={recipientPhone}
            sendSms={sendSms}
            sendEmail={sendEmail}
            defaultCollapsed
          />
        </div>
      ) : null}

      {!hideActions ? (
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-5">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit || isPending || waitingForCard}
            onClick={onSubmit}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {pendingLabel}
              </>
            ) : waitingForCard ? (
              "Waiting for card…"
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
