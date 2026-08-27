import type { BillingReportFilters } from "@/modules/billing/reports/billingReportFilters";
import {
  parseBillingReportCustomerParam,
} from "@/modules/billing/reports/billingReportFilters";
import type { BillingReportScenarioAssumptions } from "@/modules/billing/reports/billingReportProjections";

export type BillingReportViewId =
  | "overview"
  | "revenue"
  | "collections"
  | "products"
  | "projections";

export type BillingReportPeriodId =
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "quarter"
  | "year"
  | "ytd";

export type BillingReportCompareId = "none" | "previous_period";

export const BILLING_REPORT_COMPARE_OPTIONS: Array<{
  id: BillingReportCompareId;
  label: string;
}> = [
  { id: "none", label: "None" },
  { id: "previous_period", label: "Previous period" },
];

export type BillingReportSearchState = {
  view: BillingReportViewId;
  period: BillingReportPeriodId;
  filters: BillingReportFilters;
  scenario: BillingReportScenarioAssumptions;
  compare: BillingReportCompareId;
};

export const BILLING_REPORT_VIEWS: Array<{
  id: BillingReportViewId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "Key billing metrics at a glance",
  },
  {
    id: "revenue",
    label: "Revenue",
    shortLabel: "Revenue",
    description: "Paid invoices and recurring revenue",
  },
  {
    id: "collections",
    label: "Collections",
    shortLabel: "Collections",
    description: "Collected vs outstanding balances",
  },
  {
    id: "products",
    label: "Products & services",
    shortLabel: "Products",
    description: "Line items across invoices and subscriptions",
  },
  {
    id: "projections",
    label: "Projections",
    shortLabel: "Projections",
    description: "Forward-looking sales and billing outlook",
  },
];

export const BILLING_REPORT_PERIODS: Array<{
  id: BillingReportPeriodId;
  label: string;
  shortLabel: string;
}> = [
  { id: "7d", label: "Last 7 days", shortLabel: "7D" },
  { id: "30d", label: "Last 30 days", shortLabel: "30D" },
  { id: "90d", label: "Last 90 days", shortLabel: "90D" },
  { id: "month", label: "This month", shortLabel: "Month" },
  { id: "quarter", label: "This quarter", shortLabel: "Quarter" },
  { id: "year", label: "This year", shortLabel: "Year" },
  { id: "ytd", label: "Year to date", shortLabel: "YTD" },
];

const REPORT_VIEW_IDS = new Set<string>(BILLING_REPORT_VIEWS.map((v) => v.id));
const REPORT_PERIOD_IDS = new Set<string>(
  BILLING_REPORT_PERIODS.map((p) => p.id),
);

const parseNumberParam = (value: string | null, fallback: number) => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveBillingReportView = (
  params: URLSearchParams,
): BillingReportViewId => {
  const value = params.get("report");
  if (value && REPORT_VIEW_IDS.has(value)) {
    return value as BillingReportViewId;
  }
  return "overview";
};

export const resolveBillingReportPeriod = (
  params: URLSearchParams,
): BillingReportPeriodId => {
  const value = params.get("period");
  if (value && REPORT_PERIOD_IDS.has(value)) {
    return value as BillingReportPeriodId;
  }
  return "30d";
};

export const resolveBillingReportFilters = (
  params: URLSearchParams,
): BillingReportFilters => {
  const customer = parseBillingReportCustomerParam(params.get("customer"));
  const product = params.get("product")?.trim() || undefined;
  return {
    customer,
    product,
  };
};

export const resolveBillingReportScenario = (
  params: URLSearchParams,
  defaults: BillingReportScenarioAssumptions,
): BillingReportScenarioAssumptions => ({
  churnRatePercent: parseNumberParam(
    params.get("churn"),
    defaults.churnRatePercent,
  ),
  newSubsPerMonth: parseNumberParam(
    params.get("new_subs"),
    defaults.newSubsPerMonth,
  ),
  avgNewMrr: parseNumberParam(params.get("new_mrr"), defaults.avgNewMrr),
});

export const resolveBillingReportCompare = (
  params: URLSearchParams,
): BillingReportCompareId => {
  const value = params.get("compare");
  return value === "previous_period" ? "previous_period" : "none";
};

export const resolveBillingReportSearchState = (
  params: URLSearchParams,
  scenarioDefaults: BillingReportScenarioAssumptions,
): BillingReportSearchState => ({
  view: resolveBillingReportView(params),
  period: resolveBillingReportPeriod(params),
  filters: resolveBillingReportFilters(params),
  scenario: resolveBillingReportScenario(params, scenarioDefaults),
  compare: resolveBillingReportCompare(params),
});

export const buildBillingReportsSearchParams = (
  view: BillingReportViewId,
  period: BillingReportPeriodId,
  options?: {
    filters?: BillingReportFilters;
    scenario?: BillingReportScenarioAssumptions;
    compare?: BillingReportCompareId;
  },
) => {
  const next = new URLSearchParams();
  next.set("tab", "reports");
  next.set("report", view);
  next.set("period", period);

  if (options?.filters?.customer) {
    next.set(
      "customer",
      `${options.filters.customer.type}:${options.filters.customer.id}`,
    );
  }
  if (options?.filters?.product?.trim()) {
    next.set("product", options.filters.product.trim());
  }

  if (options?.scenario) {
    next.set("churn", String(options.scenario.churnRatePercent));
    next.set("new_subs", String(options.scenario.newSubsPerMonth));
    next.set("new_mrr", String(options.scenario.avgNewMrr));
  }
  if (options?.compare && options.compare !== "none") {
    next.set("compare", options.compare);
  }

  return next;
};

export const appendBillingReportParams = (
  target: URLSearchParams,
  current: URLSearchParams,
) => {
  const report = current.get("report");
  if (report) target.set("report", report);
  const period = current.get("period");
  if (period) target.set("period", period);
  const customer = current.get("customer");
  if (customer) target.set("customer", customer);
  const product = current.get("product");
  if (product) target.set("product", product);
  const churn = current.get("churn");
  if (churn) target.set("churn", churn);
  const newSubs = current.get("new_subs");
  if (newSubs) target.set("new_subs", newSubs);
  const newMrr = current.get("new_mrr");
  if (newMrr) target.set("new_mrr", newMrr);
  const compare = current.get("compare");
  if (compare) target.set("compare", compare);
};
