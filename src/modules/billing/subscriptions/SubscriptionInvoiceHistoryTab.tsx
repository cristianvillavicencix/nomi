import { useNavigate } from "react-router";
import { useGetList } from "ra-core";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { buildBillingInvoiceDetailPath } from "@/modules/billing/subscriptions/billingNavigation";
import {
  invoiceStatusSidebarLabel,
  invoiceStatusSidebarVariant,
} from "@/modules/billing/invoiceStatusSidebarLabel";
import {
  formatSavedCardMask,
} from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import type { ClientInvoice } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
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
};

const formatChargedCard = (invoice: ClientInvoice) => {
  const last4 = invoice.payment_method_last4?.trim();
  if (!last4) return "—";
  const brand = invoice.payment_method_brand?.trim();
  return brand ? `${brand} ${formatSavedCardMask(last4)}` : formatSavedCardMask(last4);
};

export const SubscriptionInvoiceHistoryTab = ({
  subscriptionId,
}: SubscriptionInvoiceHistoryTabProps) => {
  const navigate = useNavigate();
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
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No invoices from this subscription yet. Invoices appear here after each
        successful billing cycle.
      </div>
    );
  }

  return (
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
                <MoneyText
                  amount={Number(invoice.amount)}
                  currency={invoice.currency ?? "USD"}
                />
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
  );
};
