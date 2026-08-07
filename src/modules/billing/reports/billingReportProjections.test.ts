import { describe, expect, it } from "vitest";
import { computeScenarioProjections } from "@/modules/billing/reports/billingReportProjections";
import type { ClientSubscription } from "@/modules/types";

const activeSubscription: ClientSubscription = {
  id: 1,
  name: "Hosting",
  amount: 100,
  billing_interval: "monthly",
  status: "active",
};

describe("billingReportProjections", () => {
  it("keeps baseline flat and reduces conservative mrr with churn", () => {
    const rows = computeScenarioProjections({
      activeSubscriptions: [activeSubscription],
      months: 3,
      churnRatePercent: 10,
      newSubsPerMonth: 0,
      avgNewMrr: 100,
      referenceDate: new Date("2026-07-15T12:00:00"),
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]?.baselineMrr).toBe(100);
    expect(rows[0]?.conservativeMrr).toBe(100);
    expect(rows[1]?.conservativeMrr).toBe(90);
    expect(rows[2]?.conservativeMrr).toBe(81);
  });

  it("adds growth mrr from new subscriptions", () => {
    const rows = computeScenarioProjections({
      activeSubscriptions: [activeSubscription],
      months: 2,
      churnRatePercent: 0,
      newSubsPerMonth: 1,
      avgNewMrr: 50,
      referenceDate: new Date("2026-07-15T12:00:00"),
    });

    expect(rows[0]?.growthMrr).toBe(100);
    expect(rows[1]?.growthMrr).toBe(150);
  });

  it("returns zeroed rows when there are no active subscriptions", () => {
    const rows = computeScenarioProjections({
      activeSubscriptions: [],
      months: 2,
      churnRatePercent: 5,
      newSubsPerMonth: 2,
      avgNewMrr: 75,
      referenceDate: new Date("2026-07-15T12:00:00"),
    });

    expect(rows.every((row) => row.baselineMrr === 0)).toBe(true);
    expect(rows[1]?.growthMrr).toBe(150);
  });
});
