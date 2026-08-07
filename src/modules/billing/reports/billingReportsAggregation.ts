import { computeInvoiceBalanceDue } from "@/modules/billing/invoicePaymentUtils";
import { computeSubscriptionBillingSummary } from "@/modules/billing/subscriptions/subscriptionBillingSummary";
import {
  formatReportDayKey,
  formatReportDayLabel,
  formatReportMonthKey,
  formatReportMonthLabel,
  getReportDateRange,
  isDateWithinRange,
  parseReportDate,
  type ReportDateRange,
} from "@/modules/billing/reports/reportPeriodUtils";
import {
  computeScenarioProjections,
  defaultScenarioAssumptions,
  computeSubscriptionMonthlyAmount,
  type BillingReportScenarioAssumptions,
  type BillingReportScenarioProjectionRow,
} from "@/modules/billing/reports/billingReportProjections";
import type { BillingReportPeriodId } from "@/modules/billing/reports/reportsNavigation";
import type { BillingReportAgingBucket } from "@/modules/billing/reports/billingReportAging";
import { computeCollectionsAging } from "@/modules/billing/reports/billingReportAging";
import type { BillingReportFilters } from "@/modules/billing/reports/billingReportFilters";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";

export type {
  BillingReportScenarioAssumptions,
  BillingReportScenarioProjectionRow,
} from "@/modules/billing/reports/billingReportProjections";

export type BillingReportMetric = {
  label: string;
  amount: number;
  count: number;
  hint?: string;
  comparison?: {
    previousAmount: number;
    percentChange: number | null;
    direction: "up" | "down" | "flat";
    label: string;
  };
};

export type BillingReportTimePoint = {
  key: string;
  label: string;
  collected: number;
  invoiced: number;
  recurring: number;
};

export type BillingReportProductRow = {
  name: string;
  source: "invoice" | "subscription" | "mixed";
  quantity: number;
  amount: number;
  count: number;
};

export type BillingReportProjectionRow = {
  monthKey: string;
  label: string;
  expectedRecurring: number;
  expectedCollections: number;
  activeSubscriptions: number;
};

export type BillingReportsSnapshot = {
  range: ReportDateRange;
  filters?: BillingReportFilters;
  overview: {
    collected: BillingReportMetric;
    invoiced: BillingReportMetric;
    outstanding: BillingReportMetric;
    overdue: BillingReportMetric;
    activeMrr: BillingReportMetric;
    pendingSetup: BillingReportMetric;
    activeSubscriptions: BillingReportMetric;
  };
  revenueSeries: BillingReportTimePoint[];
  collectionsSeries: BillingReportTimePoint[];
  products: BillingReportProductRow[];
  projections: BillingReportProjectionRow[];
  scenarioProjections?: BillingReportScenarioProjectionRow[];
  scenarioAssumptions?: BillingReportScenarioAssumptions;
  collectionsAging: BillingReportAgingBucket[];
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const invoicePaidAmount = (invoice: ClientInvoice) => {
  const total = Number(invoice.amount) || 0;
  const paid = Number(invoice.amount_paid) || 0;
  if (paid > 0) return paid;
  return invoice.status === "paid" ? total : 0;
};

const invoiceActivityDate = (invoice: ClientInvoice) =>
  invoice.paid_at ?? invoice.sent_at ?? invoice.issue_date ?? invoice.created_at;

const subscriptionMonthlyAmount = computeSubscriptionMonthlyAmount;

const pushProductRow = (
  map: Map<string, BillingReportProductRow>,
  name: string,
  source: BillingReportProductRow["source"],
  quantity: number,
  amount: number,
) => {
  const key = name.trim().toLowerCase();
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      name: name.trim(),
      source,
      quantity,
      amount,
      count: 1,
    });
    return;
  }
  existing.quantity += quantity;
  existing.amount += amount;
  existing.count += 1;
  if (existing.source !== source) {
    existing.source = "mixed";
  }
};

const extractSubscriptionLineItems = (subscription: ClientSubscription) => {
  if (!Array.isArray(subscription.line_items)) return [];
  return subscription.line_items
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const record = row as Record<string, unknown>;
      const qty = Number(record.quantity ?? 1) || 1;
      const unitPrice = Number(record.unit_price ?? 0) || 0;
      return {
        description: String(record.description ?? subscription.name ?? "Item"),
        quantity: qty,
        amount: qty * unitPrice,
      };
    });
};

const buildMonthlyBuckets = (range: ReportDateRange) => {
  const buckets = new Map<string, BillingReportTimePoint>();
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const endMonth = new Date(range.end.getFullYear(), range.end.getMonth(), 1);

  while (cursor <= endMonth) {
    const key = formatReportMonthKey(cursor);
    buckets.set(key, {
      key,
      label: formatReportMonthLabel(key),
      collected: 0,
      invoiced: 0,
      recurring: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
};

const buildDailyBuckets = (range: ReportDateRange) => {
  const buckets = new Map<string, BillingReportTimePoint>();
  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = formatReportDayKey(cursor);
    buckets.set(key, {
      key,
      label: formatReportDayLabel(key),
      collected: 0,
      invoiced: 0,
      recurring: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
};

const chooseSeriesBuckets = (range: ReportDateRange) => {
  const daySpan =
    (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
  return daySpan <= 45 ? buildDailyBuckets(range) : buildMonthlyBuckets(range);
};

const bucketKeyForDate = (date: Date, range: ReportDateRange) => {
  const daySpan =
    (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
  return daySpan <= 45
    ? formatReportDayKey(date)
    : formatReportMonthKey(date);
};

export const computeBillingReportsSnapshot = (
  invoices: ClientInvoice[],
  subscriptions: ClientSubscription[],
  period: BillingReportPeriodId,
  referenceDate = new Date(),
  options?: {
    filters?: BillingReportFilters;
    scenario?: BillingReportScenarioAssumptions;
    rangeOverride?: ReportDateRange;
  },
): BillingReportsSnapshot => {
  const range = options?.rangeOverride ?? getReportDateRange(period, referenceDate);
  const subscriptionSummary = computeSubscriptionBillingSummary(subscriptions);
  const seriesBuckets = chooseSeriesBuckets(range);

  let collectedAmount = 0;
  let collectedCount = 0;
  let invoicedAmount = 0;
  let invoicedCount = 0;
  let outstandingAmount = 0;
  let outstandingCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;

  const todayIso = referenceDate.toISOString().slice(0, 10);
  const productMap = new Map<string, BillingReportProductRow>();

  for (const invoice of invoices) {
    const status = invoice.status?.toLowerCase() ?? "";
    if (status === "void") continue;

    const total = Number(invoice.amount) || 0;
    const balanceDue = computeInvoiceBalanceDue(
      total,
      Number(invoice.amount_paid) || 0,
    );
    const paidAmount = invoicePaidAmount(invoice);
    const activityDate = invoiceActivityDate(invoice);

    if (status !== "draft" && isDateWithinRange(activityDate, range)) {
      invoicedAmount += total;
      invoicedCount += 1;

      const bucket = seriesBuckets.get(
        bucketKeyForDate(parseReportDate(activityDate)!, range),
      );
      if (bucket) {
        bucket.invoiced += total;
      }
    }

    if (paidAmount > 0 && isDateWithinRange(invoice.paid_at ?? activityDate, range)) {
      collectedAmount += paidAmount;
      collectedCount += 1;

      const bucket = seriesBuckets.get(
        bucketKeyForDate(
          parseReportDate(invoice.paid_at ?? activityDate)!,
          range,
        ),
      );
      if (bucket) {
        bucket.collected += paidAmount;
      }
    }

    if (status === "sent" && balanceDue > 0.01) {
      outstandingAmount += balanceDue;
      outstandingCount += 1;
      if (invoice.due_date && invoice.due_date < todayIso) {
        overdueAmount += balanceDue;
        overdueCount += 1;
      }
    }

    const invoiceLabel =
      invoice.description?.trim() ||
      invoice.reference?.trim() ||
      `Invoice #${invoice.id}`;
    if (status !== "draft" && isDateWithinRange(activityDate, range)) {
      pushProductRow(productMap, invoiceLabel, "invoice", 1, total);
    }
  }

  const activeSubscriptions = subscriptions.filter(
    (row) => row.status === "active" || row.status === "trialing",
  );

  for (const subscription of subscriptions) {
    const lineItems = extractSubscriptionLineItems(subscription);
    if (lineItems.length > 0) {
      for (const item of lineItems) {
        pushProductRow(
          productMap,
          item.description,
          "subscription",
          item.quantity,
          item.amount,
        );
      }
    } else if (subscription.name?.trim()) {
      pushProductRow(
        productMap,
        subscription.name,
        "subscription",
        1,
        Number(subscription.amount) || 0,
      );
    }

    if (
      subscription.status === "active" ||
      subscription.status === "trialing"
    ) {
      const mrr = subscriptionMonthlyAmount(subscription);
      const bucket = seriesBuckets.get(formatReportMonthKey(referenceDate));
      if (bucket) {
        bucket.recurring += mrr;
      }
    }
  }

  const scenarioDefaults = defaultScenarioAssumptions(activeSubscriptions);
  const scenarioAssumptions = options?.scenario ?? scenarioDefaults;
  const scenarioProjections = computeScenarioProjections({
    activeSubscriptions,
    months: 6,
    churnRatePercent: scenarioAssumptions.churnRatePercent,
    newSubsPerMonth: scenarioAssumptions.newSubsPerMonth,
    avgNewMrr: scenarioAssumptions.avgNewMrr,
    referenceDate,
  });

  const projections: BillingReportProjectionRow[] = scenarioProjections.map(
    (row) => ({
      monthKey: row.monthKey,
      label: row.label,
      expectedRecurring: row.baselineMrr,
      expectedCollections: row.baselineMrr,
      activeSubscriptions: row.activeSubscriptions,
    }),
  );

  const revenueSeries = [...seriesBuckets.values()];
  const collectionsSeries = [...seriesBuckets.values()];
  const collectionsAging = computeCollectionsAging(invoices, referenceDate);

  return {
    range,
    filters: options?.filters,
    overview: {
      collected: {
        label: "Collected",
        amount: roundMoney(collectedAmount),
        count: collectedCount,
        hint: range.label,
      },
      invoiced: {
        label: "Invoiced",
        amount: roundMoney(invoicedAmount),
        count: invoicedCount,
        hint: range.label,
      },
      outstanding: {
        label: "Outstanding",
        amount: roundMoney(outstandingAmount),
        count: outstandingCount,
        hint: "Open invoices",
      },
      overdue: {
        label: "Overdue",
        amount: roundMoney(overdueAmount),
        count: overdueCount,
        hint: "Past due date",
      },
      activeMrr: {
        label: "Active MRR",
        amount: subscriptionSummary.activeMrr.amount,
        count: subscriptionSummary.activeMrr.count,
        hint: "Monthly recurring",
      },
      pendingSetup: {
        label: "Pending setup",
        amount: roundMoney(subscriptionSummary.pendingSetup.amount),
        count: subscriptionSummary.pendingSetup.count,
        hint: "Not billing yet",
      },
      activeSubscriptions: {
        label: "Active subscriptions",
        amount: roundMoney(
          activeSubscriptions.reduce(
            (sum, row) => sum + (Number(row.amount) || 0),
            0,
          ),
        ),
        count: activeSubscriptions.length,
        hint: "Per billing cycle",
      },
    },
    revenueSeries,
    collectionsSeries,
    products: [...productMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 25),
    projections,
    scenarioProjections,
    scenarioAssumptions,
    collectionsAging,
  };
};
