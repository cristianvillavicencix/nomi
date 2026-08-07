import type { ClientSubscription } from "@/modules/types";

export type SubscriptionBillingSummaryBucket = {
  amount: number;
  count: number;
};

export type SubscriptionBillingSummary = {
  activeMrr: SubscriptionBillingSummaryBucket;
  pendingSetup: SubscriptionBillingSummaryBucket;
  pastDue: SubscriptionBillingSummaryBucket;
};

const monthlyEquivalent = (subscription: ClientSubscription) => {
  const amount = Number(subscription.amount) || 0;
  switch (subscription.billing_interval) {
    case "weekly":
      return amount * (52 / 12);
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
};

export const computeSubscriptionBillingSummary = (
  subscriptions: ClientSubscription[],
): SubscriptionBillingSummary => {
  const summary: SubscriptionBillingSummary = {
    activeMrr: { amount: 0, count: 0 },
    pendingSetup: { amount: 0, count: 0 },
    pastDue: { amount: 0, count: 0 },
  };

  for (const row of subscriptions) {
    const status = row.status;
    const amount = Number(row.amount) || 0;

    if (status === "active" || status === "trialing") {
      summary.activeMrr.amount += monthlyEquivalent(row);
      summary.activeMrr.count += 1;
    } else if (status === "pending_setup") {
      summary.pendingSetup.amount += amount;
      summary.pendingSetup.count += 1;
    } else if (status === "past_due") {
      summary.pastDue.amount += amount;
      summary.pastDue.count += 1;
    }
  }

  summary.activeMrr.amount =
    Math.round(summary.activeMrr.amount * 100) / 100;

  return summary;
};
