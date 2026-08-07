import { describe, expect, it } from "vitest";
import { computeBillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";

const referenceDate = new Date("2026-07-15T12:00:00");

const paidInvoice: ClientInvoice = {
  id: 1,
  invoice_number: "INV-001",
  issue_date: "2026-07-10",
  due_date: "2026-07-20",
  amount: 500,
  amount_paid: 500,
  description: "Website redesign",
  status: "paid",
  paid_at: "2026-07-12T10:00:00Z",
};

const openInvoice: ClientInvoice = {
  id: 2,
  invoice_number: "INV-002",
  issue_date: "2026-07-01",
  due_date: "2026-07-05",
  amount: 200,
  amount_paid: 0,
  description: "Support retainer",
  status: "sent",
};

const activeSubscription: ClientSubscription = {
  id: 10,
  name: "Monthly hosting",
  amount: 99,
  billing_interval: "monthly",
  status: "active",
  line_items: [
    {
      description: "Hosting plan",
      quantity: 1,
      unit_price: 99,
    },
  ],
};

describe("computeBillingReportsSnapshot", () => {
  it("aggregates collected, outstanding, and product rows for the period", () => {
    const snapshot = computeBillingReportsSnapshot(
      [paidInvoice, openInvoice],
      [activeSubscription],
      "30d",
      referenceDate,
    );

    expect(snapshot.overview.collected.amount).toBe(500);
    expect(snapshot.overview.collected.count).toBe(1);
    expect(snapshot.overview.invoiced.amount).toBe(700);
    expect(snapshot.overview.outstanding.amount).toBe(200);
    expect(snapshot.overview.overdue.amount).toBe(200);
    expect(snapshot.overview.activeMrr.amount).toBe(99);
    expect(snapshot.products.some((row) => row.name === "Website redesign")).toBe(
      true,
    );
    expect(snapshot.products.some((row) => row.name === "Hosting plan")).toBe(
      true,
    );
  });

  it("builds six projection months from active subscriptions", () => {
    const snapshot = computeBillingReportsSnapshot(
      [],
      [activeSubscription],
      "30d",
      referenceDate,
    );

    expect(snapshot.projections).toHaveLength(6);
    expect(snapshot.projections[0]?.expectedRecurring).toBe(99);
    expect(snapshot.projections[0]?.activeSubscriptions).toBe(1);
    expect(snapshot.collectionsAging).toHaveLength(5);
  });
});
