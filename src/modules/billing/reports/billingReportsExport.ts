import type {
  BillingReportsSnapshot,
  BillingReportTimePoint,
} from "@/modules/billing/reports/billingReportsAggregation";
import type { BillingReportFilters } from "@/modules/billing/reports/billingReportFilters";
import type {
  BillingReportPeriodId,
  BillingReportViewId,
} from "@/modules/billing/reports/reportsNavigation";

export type BillingReportExportInput = {
  view: BillingReportViewId;
  period: BillingReportPeriodId;
  snapshot: BillingReportsSnapshot;
  filters?: BillingReportFilters;
  customerLabel?: string | null;
  productLabel?: string | null;
};

export const escapeCsvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadCsvBlob = (csv: string, filename: string) => {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildMetadataRows = (input: BillingReportExportInput) => {
  const rows: string[][] = [
    ["section", "key", "value"],
    ["metadata", "view", input.view],
    ["metadata", "period", input.period],
    ["metadata", "range_label", input.snapshot.range.label],
    ["metadata", "range_start", input.snapshot.range.start.toISOString()],
    ["metadata", "range_end", input.snapshot.range.end.toISOString()],
  ];
  if (input.customerLabel) {
    rows.push(["metadata", "customer", input.customerLabel]);
  }
  if (input.productLabel) {
    rows.push(["metadata", "product", input.productLabel]);
  }
  return rows;
};

const buildKpiRows = (snapshot: BillingReportsSnapshot) => {
  const metrics = Object.values(snapshot.overview);
  return [
    ["section", "metric", "amount", "count", "hint"],
    ...metrics.map((metric) => [
      "kpi",
      metric.label,
      String(metric.amount),
      String(metric.count),
      metric.hint ?? "",
    ]),
  ];
};

const buildSeriesRows = (
  section: string,
  series: BillingReportTimePoint[],
) => [
  ["section", "period", "collected", "invoiced", "recurring"],
  ...series.map((row) => [
    section,
    row.label,
    String(row.collected),
    String(row.invoiced),
    String(row.recurring),
  ]),
];

const buildProductRows = (snapshot: BillingReportsSnapshot) => [
  ["section", "name", "source", "quantity", "amount", "count"],
  ...snapshot.products.map((row) => [
    "product",
    row.name,
    row.source,
    String(row.quantity),
    String(row.amount),
    String(row.count),
  ]),
];

const buildProjectionRows = (snapshot: BillingReportsSnapshot) => {
  if (snapshot.scenarioProjections?.length) {
    return [
      [
        "section",
        "month",
        "baseline_mrr",
        "conservative_mrr",
        "growth_mrr",
        "active_subscriptions",
      ],
      ...snapshot.scenarioProjections.map((row) => [
        "projection",
        row.label,
        String(row.baselineMrr),
        String(row.conservativeMrr),
        String(row.growthMrr),
        String(row.activeSubscriptions),
      ]),
    ];
  }

  return [
    [
      "section",
      "month",
      "expected_recurring",
      "expected_collections",
      "active_subscriptions",
    ],
    ...snapshot.projections.map((row) => [
      "projection",
      row.label,
      String(row.expectedRecurring),
      String(row.expectedCollections),
      String(row.activeSubscriptions),
    ]),
  ];
};

export const buildBillingReportCsvRows = (input: BillingReportExportInput) => {
  const { view, snapshot } = input;
  const rows: string[][] = [...buildMetadataRows(input)];

  switch (view) {
    case "products":
      rows.push(...buildProductRows(snapshot));
      break;
    case "projections":
      rows.push(...buildProjectionRows(snapshot));
      break;
    case "revenue":
      rows.push(...buildKpiRows(snapshot));
      rows.push(...buildSeriesRows("revenue_series", snapshot.revenueSeries));
      break;
    case "collections":
      rows.push(...buildKpiRows(snapshot));
      rows.push(
        ...buildSeriesRows("collections_series", snapshot.collectionsSeries),
      );
      break;
    case "overview":
    default:
      rows.push(...buildKpiRows(snapshot));
      rows.push(...buildSeriesRows("activity_series", snapshot.revenueSeries));
      break;
  }

  return rows;
};

export const buildBillingReportCsv = (input: BillingReportExportInput) =>
  buildBillingReportCsvRows(input)
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");

export const hasExportableBillingReportData = (
  snapshot: BillingReportsSnapshot,
  view: BillingReportViewId,
) => {
  switch (view) {
    case "products":
      return snapshot.products.length > 0;
    case "projections":
      return (
        snapshot.projections.length > 0 ||
        (snapshot.scenarioProjections?.length ?? 0) > 0
      );
    default:
      return (
        snapshot.revenueSeries.some(
          (row) =>
            row.collected > 0 || row.invoiced > 0 || row.recurring > 0,
        ) ||
        Object.values(snapshot.overview).some((metric) => metric.count > 0)
      );
  }
};

export const exportBillingReportCsv = (input: BillingReportExportInput) => {
  if (!hasExportableBillingReportData(input.snapshot, input.view)) {
    return false;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `billing-report-${input.view}-${input.period}-${stamp}.csv`;
  downloadCsvBlob(buildBillingReportCsv(input), filename);
  return true;
};
