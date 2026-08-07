import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { BillingReportMetric } from "@/modules/billing/reports/billingReportsAggregation";
import { formatReportRangeDocumentLabel } from "@/modules/billing/reports/reportPeriodUtils";
import type { ReportDateRange } from "@/modules/billing/reports/reportPeriodUtils";
import { cn } from "@/lib/utils";

const ComparisonBadge = ({
  metric,
}: {
  metric: BillingReportMetric;
}) => {
  if (!metric.comparison) return null;

  const { percentChange, direction, label } = metric.comparison;
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : ArrowRight;

  return (
    <div
      className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        direction === "up" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        direction === "down" && "bg-red-500/10 text-red-700 dark:text-red-400",
        direction === "flat" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {percentChange == null ? "New" : `${percentChange > 0 ? "+" : ""}${percentChange}%`}
      <span className="font-normal text-muted-foreground">vs {label}</span>
    </div>
  );
};

export const ReportMetricCard = ({
  metric,
  href,
}: {
  metric: BillingReportMetric;
  href?: string;
}) => {
  const content = (
    <>
      <div className="text-sm text-muted-foreground">{metric.label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        <MoneyText value={metric.amount} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {metric.count} {metric.count === 1 ? "record" : "records"}
        {metric.hint ? ` · ${metric.hint}` : ""}
      </div>
      <ComparisonBadge metric={metric} />
    </>
  );

  return (
    <Card className={href ? "transition-colors hover:border-primary/30" : undefined}>
      <CardContent className="pt-6">
        {href ? (
          <Link to={href} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {content}
          </Link>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
};

export const ReportDocumentHeader = ({
  orgLabel,
  reportTitle,
  range,
}: {
  orgLabel: string;
  reportTitle: string;
  range: ReportDateRange;
}) => (
  <div className="rounded-lg border bg-muted/10 px-6 py-5 text-center">
    <div className="text-sm font-medium text-muted-foreground">{orgLabel}</div>
    <h2 className="mt-1 text-lg font-semibold">{reportTitle}</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      {formatReportRangeDocumentLabel(range)}
    </p>
  </div>
);

export const ReportDataCapBanner = () => (
  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
    Showing the latest 1,000 invoices and subscriptions. Totals may be incomplete
    for larger accounts.
  </div>
);

export const ReportSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);

export const ReportChartCard = ({
  title,
  children,
  emptyMessage = "No data for this period.",
}: {
  title: string;
  children: ReactNode;
  emptyMessage?: string;
}) => (
  <Card>
    <CardContent className="space-y-4 pt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children ?? (
        <p className="py-8 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </CardContent>
  </Card>
);
