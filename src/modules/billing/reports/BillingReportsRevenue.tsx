import { ResponsiveBar } from "@nivo/bar";
import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import { BILLING_REPORT_DRILLDOWN } from "@/modules/billing/reports/billingReportDrilldown";
import {
  ReportChartCard,
  ReportMetricCard,
  ReportMetricsGrid,
  ReportSection,
} from "@/modules/billing/reports/ReportUi";
import { billingReportBarChartDefaults } from "@/modules/billing/reports/reportChartUtils";

export const BillingReportsRevenue = ({
  snapshot,
  isPending,
}: {
  snapshot: BillingReportsSnapshot;
  isPending: boolean;
}) => {
  const chartData = snapshot.revenueSeries.map((row) => ({
    label: row.label,
    Collected: row.collected,
    Invoiced: row.invoiced,
    "Recurring (MRR)": row.recurring,
  }));

  return (
    <div className="space-y-6">
      <ReportSection description="Invoice revenue and recurring subscription MRR.">
        <ReportMetricsGrid className="sm:grid-cols-3 xl:grid-cols-3">
          <ReportMetricCard
            metric={snapshot.overview.collected}
            href={BILLING_REPORT_DRILLDOWN.collected}
          />
          <ReportMetricCard
            metric={snapshot.overview.invoiced}
            href={BILLING_REPORT_DRILLDOWN.invoiced}
          />
          <ReportMetricCard
            metric={snapshot.overview.activeMrr}
            href={BILLING_REPORT_DRILLDOWN.activeMrr}
          />
        </ReportMetricsGrid>
      </ReportSection>

      <ReportChartCard title="Revenue over time">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading chart…
          </p>
        ) : (
          <div className="h-[280px] min-h-[200px] sm:h-[320px]">
            <ResponsiveBar
              data={chartData}
              keys={["Collected", "Invoiced", "Recurring (MRR)"]}
              indexBy="label"
              groupMode="grouped"
              colors={["#16a34a", "#2563eb", "#7c3aed"]}
              {...billingReportBarChartDefaults}
            />
          </div>
        )}
      </ReportChartCard>
    </div>
  );
};
