import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import type { ClientInvoice } from "@/modules/types";

export type BillingReportAgingBucket = {
  id: "current" | "1_30" | "31_60" | "61_90" | "90_plus";
  label: string;
  amount: number;
  count: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const computeCollectionsAging = (
  invoices: ClientInvoice[],
  referenceDate = new Date(),
): BillingReportAgingBucket[] => {
  const today = referenceDate.toISOString().slice(0, 10);
  const buckets: BillingReportAgingBucket[] = [
    { id: "current", label: "Current", amount: 0, count: 0 },
    { id: "1_30", label: "1–30 days", amount: 0, count: 0 },
    { id: "31_60", label: "31–60 days", amount: 0, count: 0 },
    { id: "61_90", label: "61–90 days", amount: 0, count: 0 },
    { id: "90_plus", label: "90+ days", amount: 0, count: 0 },
  ];

  for (const invoice of invoices) {
    if (invoice.status !== "sent") continue;
    const balanceDue = computeInvoiceBalanceDue(
      Number(invoice.amount) || 0,
      Number(invoice.amount_paid) || 0,
    );
    if (balanceDue <= 0.01) continue;

    const dueDate = invoice.due_date?.slice(0, 10);
    if (!dueDate || dueDate >= today) {
      buckets[0].amount += balanceDue;
      buckets[0].count += 1;
      continue;
    }

    const dueMs = Date.parse(`${dueDate}T12:00:00`);
    const todayMs = Date.parse(`${today}T12:00:00`);
    const daysPastDue = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));

    if (daysPastDue <= 30) {
      buckets[1].amount += balanceDue;
      buckets[1].count += 1;
    } else if (daysPastDue <= 60) {
      buckets[2].amount += balanceDue;
      buckets[2].count += 1;
    } else if (daysPastDue <= 90) {
      buckets[3].amount += balanceDue;
      buckets[3].count += 1;
    } else {
      buckets[4].amount += balanceDue;
      buckets[4].count += 1;
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    amount: roundMoney(bucket.amount),
  }));
};
