import { describe, expect, it } from "vitest";
import {
  attachOverviewComparison,
  computeMetricComparison,
  getPreviousReportDateRange,
} from "@/modules/billing/reports/billingReportComparison";
import { computeBillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import type { ClientSubscription } from "@/modules/types";

const referenceDate = new Date("2026-07-15T12:00:00");

const activeSubscription: ClientSubscription = {
  id: 1,
  name: "Hosting",
  amount: 100,
  billing_interval: "monthly",
  status: "active",
};

describe("billingReportComparison", () => {
  it("computes percent change between periods", () => {
    expect(computeMetricComparison(120, 100)).toEqual({
      percentChange: 20,
      direction: "up",
    });
    expect(computeMetricComparison(80, 100)).toEqual({
      percentChange: -20,
      direction: "down",
    });
  });

  it("returns a previous month range for calendar month periods", () => {
    const previous = getPreviousReportDateRange("month", referenceDate);
    expect(previous.label).toBe("Previous month");
    expect(previous.start.getMonth()).toBe(5);
  });

  it("attaches comparison metadata to overview metrics", () => {
    const current = computeBillingReportsSnapshot(
      [],
      [activeSubscription],
      "30d",
      referenceDate,
    );
    const previous = computeBillingReportsSnapshot(
      [],
      [],
      "30d",
      referenceDate,
      {
        rangeOverride: getPreviousReportDateRange("30d", referenceDate),
      },
    );

    const compared = attachOverviewComparison(
      current,
      previous,
      "previous period",
    );

    expect(compared.overview.activeMrr.comparison?.previousAmount).toBe(0);
    expect(compared.overview.activeMrr.comparison?.direction).toBe("up");
  });
});
