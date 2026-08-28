import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { BillingReportMetric } from "@/modules/billing/reports/billingReportsAggregation";
import { cn } from "@/lib/utils";

const ComparisonBadge = ({ metric }: { metric: BillingReportMetric }) => {
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
        "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
        direction === "up" && "text-emerald-700 dark:text-emerald-400",
        direction === "down" && "text-red-700 dark:text-red-400",
        direction === "flat" && "text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {percentChange == null
        ? "New"
        : `${percentChange > 0 ? "+" : ""}${percentChange}%`}
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {metric.label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
        <MoneyText value={metric.amount} />
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {metric.count} {metric.count === 1 ? "record" : "records"}
        {metric.hint ? ` · ${metric.hint}` : ""}
      </div>
      <ComparisonBadge metric={metric} />
    </>
  );

  const className = cn(
    "block rounded-2xl bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]",
    href &&
      "transition-colors hover:bg-black/[0.055] active:bg-black/[0.07] dark:hover:bg-white/[0.08]",
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cn(
          className,
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
};

export const ReportMetricsGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4",
      className,
    )}
  >
    {children}
  </div>
);

/** @deprecated Prefer flat chrome; kept for any leftover imports. */
export const ReportDocumentHeader = ({
  orgLabel,
  reportTitle,
  rangeLabel,
}: {
  orgLabel: string;
  reportTitle: string;
  rangeLabel: string;
}) => (
  <div className="space-y-0.5">
    <p className="text-xs text-muted-foreground">{orgLabel}</p>
    <h2 className="text-base font-semibold">{reportTitle}</h2>
    <p className="text-xs text-muted-foreground">{rangeLabel}</p>
  </div>
);

export const ReportDataCapBanner = () => (
  <div className="mx-4 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-muted-foreground md:mx-0">
    Showing the latest 1,000 invoices and subscriptions. Totals may be
    incomplete for larger accounts.
  </div>
);

export const ReportSection = ({
  title,
  description,
  children,
}: {
  /** Optional section heading — prefer omitting when it duplicates the active tab. */
  title?: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="space-y-4">
    {title || description ? (
      <div className="space-y-0.5">
        {title ? (
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        ) : null}
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    ) : null}
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
  <section className="space-y-3">
    <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    <div className="rounded-2xl bg-black/[0.025] p-3 dark:bg-white/[0.04] sm:p-4">
      {children ?? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </div>
  </section>
);
