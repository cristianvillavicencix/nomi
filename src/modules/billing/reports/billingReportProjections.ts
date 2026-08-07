import {
  formatReportMonthKey,
  formatReportMonthLabel,
} from "@/modules/billing/reports/reportPeriodUtils";
import type { ClientSubscription } from "@/modules/types";

export type BillingReportScenarioAssumptions = {
  churnRatePercent: number;
  newSubsPerMonth: number;
  avgNewMrr: number;
};

export type BillingReportScenarioProjectionRow = {
  monthKey: string;
  label: string;
  baselineMrr: number;
  conservativeMrr: number;
  growthMrr: number;
  activeSubscriptions: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const computeSubscriptionMonthlyAmount = (
  subscription: ClientSubscription,
) => {
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

export const computeAverageActiveMrr = (
  activeSubscriptions: ClientSubscription[],
) => {
  if (activeSubscriptions.length === 0) return 0;
  const total = activeSubscriptions.reduce(
    (sum, row) => sum + computeSubscriptionMonthlyAmount(row),
    0,
  );
  return roundMoney(total / activeSubscriptions.length);
};

export const defaultScenarioAssumptions = (
  activeSubscriptions: ClientSubscription[],
): BillingReportScenarioAssumptions => ({
  churnRatePercent: 2,
  newSubsPerMonth: 0,
  avgNewMrr: computeAverageActiveMrr(activeSubscriptions),
});

export const computeScenarioProjections = ({
  activeSubscriptions,
  months = 6,
  churnRatePercent,
  newSubsPerMonth,
  avgNewMrr,
  referenceDate = new Date(),
}: {
  activeSubscriptions: ClientSubscription[];
  months?: number;
  churnRatePercent: number;
  newSubsPerMonth: number;
  avgNewMrr: number;
  referenceDate?: Date;
}): BillingReportScenarioProjectionRow[] => {
  const baselineMrr = roundMoney(
    activeSubscriptions.reduce(
      (sum, row) => sum + computeSubscriptionMonthlyAmount(row),
      0,
    ),
  );
  const activeCount = activeSubscriptions.length;
  const churnFactor = Math.max(0, 1 - churnRatePercent / 100);
  const monthlyNewMrr = roundMoney(newSubsPerMonth * avgNewMrr);

  const projectionStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );

  let conservativeMrr = baselineMrr;
  let growthMrr = baselineMrr;
  const rows: BillingReportScenarioProjectionRow[] = [];

  for (let offset = 0; offset < months; offset += 1) {
    const monthDate = new Date(
      projectionStart.getFullYear(),
      projectionStart.getMonth() + offset,
      1,
    );
    const monthKey = formatReportMonthKey(monthDate);

    if (offset > 0) {
      conservativeMrr = roundMoney(conservativeMrr * churnFactor);
      growthMrr = roundMoney(growthMrr * churnFactor + monthlyNewMrr);
    }

    rows.push({
      monthKey,
      label: formatReportMonthLabel(monthKey),
      baselineMrr,
      conservativeMrr,
      growthMrr,
      activeSubscriptions: activeCount,
    });
  }

  return rows;
};
