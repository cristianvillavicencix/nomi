import { describe, expect, it } from "vitest";
import {
  buildBillingReportCsv,
  buildBillingReportCsvRows,
  escapeCsvCell,
  hasExportableBillingReportData,
} from "@/modules/billing/reports/billingReportsExport";
import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import { getReportDateRange } from "@/modules/billing/reports/reportPeriodUtils";

const baseSnapshot = (): BillingReportsSnapshot => {
  const range = getReportDateRange("30d", new Date("2026-07-15T12:00:00"));
  return {
    range,
    overview: {
      collected: { label: "Collected", amount: 500, count: 1, hint: range.label },
      invoiced: { label: "Invoiced", amount: 700, count: 2, hint: range.label },
      outstanding: { label: "Outstanding", amount: 200, count: 1, hint: "Open invoices" },
      overdue: { label: "Overdue", amount: 200, count: 1, hint: "Past due date" },
      activeMrr: { label: "Active MRR", amount: 99, count: 1, hint: "Monthly recurring" },
      pendingSetup: { label: "Pending setup", amount: 0, count: 0, hint: "Not billing yet" },
      activeSubscriptions: { label: "Active subscriptions", amount: 99, count: 1, hint: "Per billing cycle" },
    },
    revenueSeries: [
      {
        key: "2026-07",
        label: "Jul '26",
        collected: 500,
        invoiced: 700,
        recurring: 99,
      },
    ],
    collectionsSeries: [
      {
        key: "2026-07",
        label: "Jul '26",
        collected: 500,
        invoiced: 700,
        recurring: 99,
      },
    ],
    products: [
      {
        name: "Hosting plan",
        source: "subscription",
        quantity: 1,
        amount: 99,
        count: 1,
      },
    ],
    projections: [
      {
        monthKey: "2026-07",
        label: "Jul '26",
        expectedRecurring: 99,
        expectedCollections: 99,
        activeSubscriptions: 1,
      },
    ],
    scenarioProjections: [
      {
        monthKey: "2026-07",
        label: "Jul '26",
        baselineMrr: 99,
        conservativeMrr: 97.02,
        growthMrr: 99,
        activeSubscriptions: 1,
      },
    ],
    collectionsAging: [
      { id: "current", label: "Current", amount: 0, count: 0 },
      { id: "1_30", label: "1–30 days", amount: 200, count: 1 },
      { id: "31_60", label: "31–60 days", amount: 0, count: 0 },
      { id: "61_90", label: "61–90 days", amount: 0, count: 0 },
      { id: "90_plus", label: "90+ days", amount: 0, count: 0 },
    ],
  };
};

describe("billingReportsExport", () => {
  it("escapes csv cells with commas and quotes", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell('Say "hello", world')).toBe('"Say ""hello"", world"');
  });

  it("builds overview rows with metadata and kpis", () => {
    const rows = buildBillingReportCsvRows({
      view: "overview",
      period: "30d",
      snapshot: baseSnapshot(),
    });

    expect(rows[0]).toEqual(["section", "key", "value"]);
    expect(rows.some((row) => row[0] === "kpi" && row[1] === "Collected")).toBe(
      true,
    );
    expect(rows.some((row) => row[0] === "activity_series")).toBe(true);
  });

  it("builds product and projection csv sections", () => {
    const productCsv = buildBillingReportCsv({
      view: "products",
      period: "30d",
      snapshot: baseSnapshot(),
    });
    expect(productCsv).toContain("Hosting plan");

    const projectionCsv = buildBillingReportCsv({
      view: "projections",
      period: "30d",
      snapshot: baseSnapshot(),
    });
    expect(projectionCsv).toContain("baseline_mrr");
    expect(projectionCsv).toContain("conservative_mrr");
  });

  it("detects exportable data per view", () => {
    const snapshot = baseSnapshot();
    expect(hasExportableBillingReportData(snapshot, "overview")).toBe(true);
    expect(hasExportableBillingReportData({ ...snapshot, products: [] }, "products")).toBe(
      false,
    );
  });
});
