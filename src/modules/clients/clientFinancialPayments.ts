import type { Deal, DealClientPayment } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice } from "@/modules/types";

export type ClientFinancialPaymentRow = {
  id: string;
  sortKey: string;
  dateLabel: string;
  payerLabel: string;
  reference: string;
  status: string;
  statusVariant: "default" | "secondary" | "destructive" | "outline";
  paymentMode: string;
  amount: number;
  invoiceId?: ClientInvoice["id"];
  invoiceNumber?: string;
  ticketId?: ClientInvoice["ticket_id"];
  dealId?: Deal["id"];
  dealName?: string;
  source: "invoice" | "project";
};

export const invoiceHasRecordedPayment = (invoice: ClientInvoice) =>
  invoice.status !== "void" &&
  (Number(invoice.amount_paid) > 0 || invoice.status === "paid");

export const getInvoicePaymentReference = (invoice: ClientInvoice) => {
  if (invoice.reference?.trim()) return invoice.reference.trim();
  const paymentIntent = invoice.stripe_payment_intent_id?.trim();
  if (paymentIntent) {
    const compact = paymentIntent.replace(/^pi_/, "");
    return compact.length > 12
      ? compact.slice(-12).toUpperCase()
      : compact.toUpperCase();
  }
  return invoice.invoice_number;
};

export const getInvoicePaymentMode = (invoice: ClientInvoice) => {
  if (invoice.stripe_payment_intent_id?.trim()) return "Stripe";
  if (invoice.payment_method_brand?.trim()) {
    return invoice.payment_method_brand.trim();
  }
  return "Manual";
};

const formatPaymentDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatBillingDate(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const buildInvoicePaymentRows = (
  invoices: ClientInvoice[],
  payerLabel: string,
): ClientFinancialPaymentRow[] =>
  invoices.filter(invoiceHasRecordedPayment).map((invoice) => {
    const paidAmount =
      Number(invoice.amount_paid) > 0
        ? Number(invoice.amount_paid)
        : Number(invoice.amount ?? 0);
    const paidAt = invoice.paid_at ?? invoice.updated_at ?? invoice.issue_date;

    return {
      id: `invoice-${invoice.id}`,
      sortKey: paidAt ?? "",
      dateLabel: formatPaymentDateTime(paidAt),
      payerLabel,
      reference: getInvoicePaymentReference(invoice),
      status: invoice.status === "paid" ? "Paid" : "Partial",
      statusVariant: invoice.status === "paid" ? "default" : "secondary",
      paymentMode: getInvoicePaymentMode(invoice),
      amount: paidAmount,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      ticketId: invoice.ticket_id ?? undefined,
      source: "invoice",
    };
  });

export const buildProjectPaymentRows = (
  payments: DealClientPayment[],
  dealsById: Record<string, Deal>,
  payerLabel: string,
): ClientFinancialPaymentRow[] =>
  payments.map((payment) => ({
    id: `project-${payment.id}`,
    sortKey: payment.payment_date ?? "",
    dateLabel: formatBillingDate(payment.payment_date),
    payerLabel,
    reference:
      payment.reference_number || payment.check_number || payment.notes || "—",
    status: payment.status?.replace(/_/g, " ") ?? "—",
    statusVariant: "outline",
    paymentMode: payment.payment_method?.replace(/_/g, " ") || "—",
    amount: Number(payment.amount ?? 0),
    dealId: payment.deal_id ?? undefined,
    dealName: payment.deal_id
      ? dealsById[String(payment.deal_id)]?.name
      : undefined,
    source: "project",
  }));

export const mergeClientFinancialPaymentRows = (
  invoiceRows: ClientFinancialPaymentRow[],
  projectRows: ClientFinancialPaymentRow[],
) =>
  [...invoiceRows, ...projectRows].sort((left, right) =>
    right.sortKey.localeCompare(left.sortKey),
  );
