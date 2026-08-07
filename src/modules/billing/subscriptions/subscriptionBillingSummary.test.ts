import { describe, expect, it } from "vitest";
import { computeSubscriptionBillingSummary } from "@/modules/billing/subscriptions/subscriptionBillingSummary";
import type { ClientSubscription } from "@/modules/types";

const row = (
  partial: Partial<ClientSubscription> & Pick<ClientSubscription, "id" | "name" | "amount">,
): ClientSubscription => ({
  billing_interval: "monthly",
  ...partial,
});

describe("computeSubscriptionBillingSummary", () => {
  it("aggregates active MRR, pending setup, and past due buckets", () => {
    const summary = computeSubscriptionBillingSummary([
      row({ id: 1, name: "Active", amount: 100, status: "active" }),
      row({ id: 2, name: "Trialing", amount: 50, status: "trialing" }),
      row({ id: 3, name: "Pending", amount: 25, status: "pending_setup" }),
      row({ id: 4, name: "Past due", amount: 40, status: "past_due" }),
    ]);

    expect(summary.activeMrr).toEqual({ amount: 150, count: 2 });
    expect(summary.pendingSetup).toEqual({ amount: 25, count: 1 });
    expect(summary.pastDue).toEqual({ amount: 40, count: 1 });
  });
});
