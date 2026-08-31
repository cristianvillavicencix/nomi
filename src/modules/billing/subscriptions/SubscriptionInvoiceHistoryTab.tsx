import { Loader2, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";
import { useGetList } from "ra-core";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { buildBillingInvoiceDetailPath } from "@/modules/billing/subscriptions/billingNavigation";
import {
  canSyncSubscriptionFromStripe,
  formatSubscriptionNextBillingLabel,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { useSubscriptionStripeSync } from "@/modules/billing/subscriptions/useSubscriptionStripeSync";
import {
  invoiceStatusSidebarLabel,
  invoiceStatusSidebarVariant,
} from "@/modules/billing/invoiceStatusSidebarLabel";
import { formatSavedCardMask } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SubscriptionInvoiceHistoryTabProps = {
  subscriptionId: string;
  subscription?: ClientSubscription;
};

const formatChargedCard = (invoice: ClientInvoice) => {
  const last4 = invoice.payment_method_last4?.trim();
  if (!last4) return "—";
  const brand = invoice.payment_method_brand?.trim();
  return brand ? `${brand} ${formatSavedCardMask(last4)}` : formatSavedCardMask(last4);
};

const buildEmptyStateMessage = (subscription?: ClientSubscription) => {
  if (!subscription) {
    return "No invoices from this subscription yet. Invoices appear here after each successful billing cycle.";
  }

  if (
    (subscription.status === "active" || subscription.status === "trialing") &&
    !subscription.last_billed_at
  ) {
    const nextBilling = formatSubscriptionNextBillingLabel(subscription);
    if (canSyncSubscriptionFromStripe(subscription)) {
      return `No charges recorded in Sigma yet. ${nextBilling}. If Stripe already charged this subscription, sync invoices from Stripe below.`;
    }
    return `No charges recorded yet. ${nextBilling}.`;
  }

  return "No invoices from this subscription yet. Invoices appear here after each successful billing cycle.";
};

export const SubscriptionInvoiceHistoryTab = ({
  subscriptionId,
  subscription,
}: SubscriptionInvoiceHistoryTabProps) => {
  const navigate = useNavigate();
  const { syncFromStripe, isSyncing } = useSubscriptionStripeSync(subscription, {
    enabled: false,
  });
  const canSync = Boolean(
    subscription && canSyncSubscriptionFromStripe(subscription),
  );
  const { data: invoices = [], isPending } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "subscription_id@eq": subscriptionId },
      sort: { field: "issue_date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: Boolean(subscriptionId) },
  );

  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground">Loading invoice history…</p>
    );
  }

  if (!invoices.length) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {buildEmptyStateMessage(subscription)}
        </p>
        {canSync ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={() => syncFromStripe()}
          >
            {isSyncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Sync invoices from Stripe
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canSync ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            disabled={isSyncing}
            onClick={() => syncFromStripe()}
          >
            {isSyncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Sync from Stripe
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={String(invoice.id)}
                className="cursor-pointer"
                onClick={() =>
                  navigate(buildBillingInvoiceDetailPath(String(invoice.id)))
                }
              >
                <TableCell className="font-medium">
                  {invoice.invoice_number ?? `#${invoice.id}`}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBillingDate(
                    invoice.issue_date ??
                      invoice.paid_at?.slice(0, 10) ??
                      null,
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <MoneyText value={Number(invoice.amount)} />
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {formatChargedCard(invoice)}
                </TableCell>
                <TableCell>
                  <Badge variant={invoiceStatusSidebarVariant(invoice.status)}>
                    {invoiceStatusSidebarLabel(invoice.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Click a row to open the invoice in Billing.
        </p>
      </div>
    </div>
  );
};
