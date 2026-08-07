import { describe, expect, it } from "vitest";
import { computeCollectionsAging } from "@/modules/billing/reports/billingReportAging";
import type { ClientInvoice } from "@/modules/types";

const referenceDate = new Date("2026-07-15T12:00:00");

describe("computeCollectionsAging", () => {
  it("groups open balances into aging buckets", () => {
    const invoices: ClientInvoice[] = [
      {
        id: 1,
        invoice_number: "INV-1",
        issue_date: "2026-06-01",
        due_date: "2026-07-20",
        amount: 100,
        amount_paid: 0,
        description: "Future due",
        status: "sent",
      },
      {
        id: 2,
        invoice_number: "INV-2",
        issue_date: "2026-06-01",
        due_date: "2026-07-01",
        amount: 200,
        amount_paid: 0,
        description: "Recently overdue",
        status: "sent",
      },
      {
        id: 3,
        invoice_number: "INV-3",
        issue_date: "2026-03-01",
        due_date: "2026-04-01",
        amount: 300,
        amount_paid: 0,
        description: "Very overdue",
        status: "sent",
      },
    ];

    const buckets = computeCollectionsAging(invoices, referenceDate);
    expect(buckets.find((bucket) => bucket.id === "current")?.amount).toBe(100);
    expect(buckets.find((bucket) => bucket.id === "1_30")?.amount).toBe(200);
    expect(buckets.find((bucket) => bucket.id === "90_plus")?.amount).toBe(300);
  });
});
