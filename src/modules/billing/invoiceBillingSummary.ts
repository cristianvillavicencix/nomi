import { todayIso } from "@/modules/billing/billingDisplayUtils";
import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import type { ClientInvoice } from "@/modules/types";

export type InvoiceBillingSummaryBucket = {
  amount: number;
  count: number;
};

export type InvoiceBillingSummary = {
  outstanding: InvoiceBillingSummaryBucket;
  overdue: InvoiceBillingSummaryBucket;
  paid30d: InvoiceBillingSummaryBucket;
  draft: InvoiceBillingSummaryBucket;
};

const PAID_LOOKBACK_DAYS = 30;

const paidWithinLast30Days = (invoice: ClientInvoice) => {
  const paidAt = invoice.paid_at ?? invoice.updated_at;
  if (!paidAt) return false;
  const paidTime = new Date(paidAt).getTime();
  if (Number.isNaN(paidTime)) return false;
  const cutoff = Date.now() - PAID_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return paidTime >= cutoff;
};

export const computeInvoiceBillingSummary = (
  invoices: ClientInvoice[],
): InvoiceBillingSummary => {
  const today = todayIso();
  const summary: InvoiceBillingSummary = {
    outstanding: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
    paid30d: { amount: 0, count: 0 },
    draft: { amount: 0, count: 0 },
  };

  for (const invoice of invoices) {
    const status = invoice.status?.toLowerCase() ?? "";
    if (status === "void") continue;

    const total = Number(invoice.amount) || 0;
    const balanceDue = computeInvoiceBalanceDue(
      total,
      Number(invoice.amount_paid) || 0,
    );

    if (status === "draft") {
      summary.draft.amount += total;
      summary.draft.count += 1;
      continue;
    }

    if (status === "paid" && paidWithinLast30Days(invoice)) {
      const paidAmount =
        Number(invoice.amount_paid) > 0 ? Number(invoice.amount_paid) : total;
      summary.paid30d.amount += paidAmount;
      summary.paid30d.count += 1;
      continue;
    }

    if (status === "sent" && balanceDue > 0.01) {
      summary.outstanding.amount += balanceDue;
      summary.outstanding.count += 1;

      if (invoice.due_date && invoice.due_date < today) {
        summary.overdue.amount += balanceDue;
        summary.overdue.count += 1;
      }
    }
  }

  summary.outstanding.amount =
    Math.round(summary.outstanding.amount * 100) / 100;
  summary.overdue.amount = Math.round(summary.overdue.amount * 100) / 100;
  summary.paid30d.amount = Math.round(summary.paid30d.amount * 100) / 100;
  summary.draft.amount = Math.round(summary.draft.amount * 100) / 100;

  return summary;
};
