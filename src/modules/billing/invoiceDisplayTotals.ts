import {
  calculateInvoiceTotals,
  discountPercentFromAmount,
  invoiceLineTotal,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import type { ClientInvoice } from "@/modules/types";
export type InvoiceDisplayTotals = {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountedSubtotal: number;
  feeAmount: number;
  total: number;
};

export type InvoiceDisplaySource = Pick<
  ClientInvoice,
  | "subscription_id"
  | "stripe_subscription_invoice_id"
  | "amount"
  | "subtotal"
  | "fee_amount"
  | "discount_amount"
  | "amount_paid"
>;

/** Stripe subscription invoices are charged at the list price — no transfer-fee gross-up. */
export const isSubscriptionMirroredInvoice = (
  invoice: Pick<
    ClientInvoice,
    "subscription_id" | "stripe_subscription_invoice_id"
  > | null | undefined,
) =>
  Boolean(invoice?.subscription_id) ||
  Boolean(invoice?.stripe_subscription_invoice_id?.trim());

const lineSubtotal = (lines: InvoiceLineDraft[]) =>
  lines.reduce(
    (sum, line) => sum + invoiceLineTotal(line.quantity, line.unit_price),
    0,
  );

/**
 * Resolves invoice totals for display, PDF, and balance-due math.
 * Standalone invoices gross up Stripe fees; subscription-mirrored invoices use stored amounts.
 */
export const resolveInvoiceDisplayTotals = (
  invoice: InvoiceDisplaySource | null | undefined,
  lines: InvoiceLineDraft[],
  discountPercent = 0,
): InvoiceDisplayTotals => {
  if (invoice && isSubscriptionMirroredInvoice(invoice)) {
    const subtotal =
      Number(invoice.subtotal) || lineSubtotal(lines) || Number(invoice.amount) || 0;
    const discountAmount = Number(invoice.discount_amount) || 0;
    const feeAmount = Number(invoice.fee_amount) || 0;
    const discountedSubtotal = Math.round((subtotal - discountAmount) * 100) / 100;
    const total =
      Number(invoice.amount) ||
      Math.round((discountedSubtotal + feeAmount) * 100) / 100;
    const percent =
      discountPercent > 0
        ? discountPercent
        : discountPercentFromAmount(subtotal, discountAmount);

    return {
      subtotal,
      discountPercent: percent,
      discountAmount,
      discountedSubtotal,
      feeAmount,
      total,
    };
  }

  return calculateInvoiceTotals(lines, discountPercent);
};

export const resolveInvoiceBalanceDue = (
  invoice: InvoiceDisplaySource | null | undefined,
  totals?: Pick<InvoiceDisplayTotals, "total">,
) => {
  const total =
    invoice && isSubscriptionMirroredInvoice(invoice)
      ? Number(invoice.amount) || totals?.total || 0
      : (totals?.total ?? Number(invoice?.amount)) || 0;

  return computeInvoiceBalanceDue(total, Number(invoice?.amount_paid) || 0);
};
