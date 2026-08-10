import { describe, expect, it } from "vitest";
import {
  isSubscriptionMirroredInvoice,
  resolveInvoiceBalanceDue,
  resolveInvoiceDisplayTotals,
} from "./invoiceDisplayTotals";
import type { InvoiceLineDraft } from "./invoiceLineUtils";

const subscriptionLines: InvoiceLineDraft[] = [
  {
    key: "1",
    title: "Marketing Starter",
    quantity: 1,
    unit: "ea",
    unit_price: 150,
    sort_order: 0,
  },
];

const subscriptionInvoice = {
  subscription_id: 42,
  stripe_subscription_invoice_id: "in_stripe_123",
  amount: 150,
  subtotal: 150,
  fee_amount: 0,
  discount_amount: 0,
  amount_paid: 150,
};

describe("isSubscriptionMirroredInvoice", () => {
  it("returns true when subscription_id is set", () => {
    expect(isSubscriptionMirroredInvoice({ subscription_id: 1 })).toBe(true);
  });

  it("returns true when stripe_subscription_invoice_id is set", () => {
    expect(
      isSubscriptionMirroredInvoice({
        stripe_subscription_invoice_id: "in_abc",
      }),
    ).toBe(true);
  });

  it("returns false for standalone invoices", () => {
    expect(isSubscriptionMirroredInvoice({})).toBe(false);
  });
});

describe("resolveInvoiceDisplayTotals", () => {
  it("does not gross up transfer fee for subscription invoices", () => {
    const totals = resolveInvoiceDisplayTotals(
      subscriptionInvoice,
      subscriptionLines,
    );

    expect(totals.subtotal).toBe(150);
    expect(totals.feeAmount).toBe(0);
    expect(totals.total).toBe(150);
  });

  it("grosses up transfer fee for standalone invoices", () => {
    const totals = resolveInvoiceDisplayTotals(null, subscriptionLines);

    expect(totals.subtotal).toBe(150);
    expect(totals.feeAmount).toBe(4.79);
    expect(totals.total).toBe(154.79);
  });
});

describe("resolveInvoiceBalanceDue", () => {
  it("returns zero for a paid subscription invoice", () => {
    const totals = resolveInvoiceDisplayTotals(
      subscriptionInvoice,
      subscriptionLines,
    );

    expect(resolveInvoiceBalanceDue(subscriptionInvoice, totals)).toBe(0);
  });

  it("uses grossed-up total for unpaid standalone invoices", () => {
    const standaloneInvoice = {
      amount: 154.79,
      subtotal: 150,
      fee_amount: 4.79,
      discount_amount: 0,
      amount_paid: 0,
    };
    const totals = resolveInvoiceDisplayTotals(null, subscriptionLines);

    expect(resolveInvoiceBalanceDue(standaloneInvoice, totals)).toBe(154.79);
  });
});
