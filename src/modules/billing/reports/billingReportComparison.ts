import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import type { BillingReportPeriodId } from "@/modules/billing/reports/reportsNavigation";
import type { ReportDateRange } from "@/modules/billing/reports/reportPeriodUtils";
import { getReportDateRange } from "@/modules/billing/reports/reportPeriodUtils";

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfQuarter = (date: Date) => {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
};

export const getPreviousReportDateRange = (
  period: BillingReportPeriodId,
  referenceDate = new Date(),
): ReportDateRange => {
  const current = getReportDateRange(period, referenceDate);

  switch (period) {
    case "month": {
      const monthStart = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth() - 1,
        1,
      );
      const monthEnd = new Date(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        0,
      );
      return {
        start: startOfDay(monthStart),
        end: endOfDay(monthEnd),
        label: "Previous month",
      };
    }
    case "quarter": {
      const currentQuarterStart = startOfQuarter(referenceDate);
      const prevQuarterStart = new Date(
        currentQuarterStart.getFullYear(),
        currentQuarterStart.getMonth() - 3,
        1,
      );
      const prevQuarterEnd = new Date(
        currentQuarterStart.getFullYear(),
        currentQuarterStart.getMonth(),
        0,
      );
      return {
        start: startOfDay(prevQuarterStart),
        end: endOfDay(prevQuarterEnd),
        label: "Previous quarter",
      };
    }
    case "year": {
      const year = referenceDate.getFullYear() - 1;
      return {
        start: startOfDay(new Date(year, 0, 1)),
        end: endOfDay(new Date(year, 11, 31)),
        label: "Previous year",
      };
    }
    case "ytd": {
      const year = referenceDate.getFullYear() - 1;
      return {
        start: startOfDay(new Date(year, 0, 1)),
        end: endOfDay(
          new Date(year, referenceDate.getMonth(), referenceDate.getDate()),
        ),
        label: "Previous year to date",
      };
    }
    default: {
      const durationMs = current.end.getTime() - current.start.getTime();
      const prevEnd = endOfDay(
        new Date(current.start.getTime() - 24 * 60 * 60 * 1000),
      );
      const prevStart = startOfDay(new Date(prevEnd.getTime() - durationMs));
      return {
        start: prevStart,
        end: prevEnd,
        label: "Previous period",
      };
    }
  }
};

export const computeMetricComparison = (
  currentAmount: number,
  previousAmount: number,
) => {
  if (previousAmount === 0) {
    return currentAmount === 0
      ? { percentChange: 0, direction: "flat" as const }
      : { percentChange: null, direction: "up" as const };
  }
  const percentChange =
    Math.round(((currentAmount - previousAmount) / previousAmount) * 1000) / 10;
  if (percentChange > 0) return { percentChange, direction: "up" as const };
  if (percentChange < 0) return { percentChange, direction: "down" as const };
  return { percentChange: 0, direction: "flat" as const };
};

export const attachOverviewComparison = (
  current: BillingReportsSnapshot,
  previous: BillingReportsSnapshot | null,
  comparisonLabel: string,
): BillingReportsSnapshot => {
  if (!previous) return current;

  const overview = Object.fromEntries(
    Object.entries(current.overview).map(([key, metric]) => {
      const prevMetric =
        previous.overview[key as keyof typeof previous.overview];
      const { percentChange, direction } = computeMetricComparison(
        metric.amount,
        prevMetric.amount,
      );
      return [
        key,
        {
          ...metric,
          comparison: {
            previousAmount: prevMetric.amount,
            percentChange,
            direction,
            label: comparisonLabel,
          },
        },
      ];
    }),
  ) as typeof current.overview;

  return { ...current, overview };
};
