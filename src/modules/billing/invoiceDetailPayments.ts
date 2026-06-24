import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  getInvoicePaymentReference,
  invoiceHasRecordedPayment,
} from "@/modules/clients/clientFinancialPayments";
import type { ClientInvoice, ClientInvoiceAutoChargeLog } from "@/modules/types";

export type InvoiceDetailPaymentRow = {
  id: string;
  paymentNumber: string;
  dateLabel: string;
  reference: string;
  status: "Paid" | "Partial";
  statusVariant: "default" | "secondary";
  cardBrand?: string | null;
  cardLast4?: string | null;
  amount: number;
  sortKey: string;
};

const formatPaymentDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatBillingDate(value);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatStripeReference = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 12)}…`;
};

const logAmount = (log: ClientInvoiceAutoChargeLog) =>
  Math.round((Number(log.amount_cents) || 0) / 100 * 100) / 100;

export const buildInvoiceDetailPaymentRows = (
  invoice: ClientInvoice,
  chargeLogs: ClientInvoiceAutoChargeLog[] = [],
): InvoiceDetailPaymentRow[] => {
  if (!invoiceHasRecordedPayment(invoice)) return [];

  const succeededLogs = chargeLogs
    .filter((log) => log.status === "succeeded")
    .sort((left, right) =>
      String(left.attempted_at ?? "").localeCompare(String(right.attempted_at ?? "")),
    );

  const rows: InvoiceDetailPaymentRow[] = succeededLogs.map((log) => ({
    id: `log-${log.id}`,
    paymentNumber: String(log.id),
    dateLabel: formatPaymentDate(log.attempted_at),
    reference: formatStripeReference(log.stripe_payment_intent_id),
    status: "Paid",
    statusVariant: "default",
    cardBrand: invoice.payment_method_brand,
    cardLast4: invoice.payment_method_last4,
    amount: logAmount(log),
    sortKey: log.attempted_at ?? "",
  }));

  const totalPaid = Number(invoice.amount_paid) || 0;
  const loggedTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const remainder = Math.round((totalPaid - loggedTotal) * 100) / 100;

  if (remainder > 0.01) {
    rows.unshift({
      id: `invoice-${invoice.id}-primary`,
      paymentNumber: String(invoice.id),
      dateLabel: formatPaymentDate(
        invoice.paid_at ?? invoice.updated_at ?? invoice.issue_date,
      ),
      reference: formatStripeReference(
        invoice.reference ?? invoice.stripe_payment_intent_id,
      ),
      status: invoice.status === "paid" ? "Paid" : "Partial",
      statusVariant: invoice.status === "paid" ? "default" : "secondary",
      cardBrand: invoice.payment_method_brand,
      cardLast4: invoice.payment_method_last4,
      amount: remainder,
      sortKey: invoice.paid_at ?? invoice.updated_at ?? invoice.issue_date ?? "",
    });
  }

  if (rows.length === 0 && totalPaid > 0) {
    rows.push({
      id: `invoice-${invoice.id}`,
      paymentNumber: String(invoice.id),
      dateLabel: formatPaymentDate(
        invoice.paid_at ?? invoice.updated_at ?? invoice.issue_date,
      ),
      reference: formatStripeReference(getInvoicePaymentReference(invoice)),
      status: invoice.status === "paid" ? "Paid" : "Partial",
      statusVariant: invoice.status === "paid" ? "default" : "secondary",
      cardBrand: invoice.payment_method_brand,
      cardLast4: invoice.payment_method_last4,
      amount: totalPaid,
      sortKey: invoice.paid_at ?? invoice.updated_at ?? invoice.issue_date ?? "",
    });
  }

  return rows.sort((left, right) => right.sortKey.localeCompare(left.sortKey));
};
