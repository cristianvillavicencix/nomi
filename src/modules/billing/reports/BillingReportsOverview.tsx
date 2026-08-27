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

type BillingReportsOverviewProps = {
  snapshot: BillingReportsSnapshot;
  isPending: boolean;
};

export const BillingReportsOverview = ({
  snapshot,
  isPending,
}: BillingReportsOverviewProps) => {
  const chartData = snapshot.revenueSeries.map((row) => ({
    label: row.label,
    Collected: row.collected,
    Invoiced: row.invoiced,
    Recurring: row.recurring,
  }));

  const hasChartData = chartData.some(
    (row) => row.Collected > 0 || row.Invoiced > 0 || row.Recurring > 0,
  );

  return (
    <div className="space-y-6">
      <ReportSection
        description={`Billing performance for ${snapshot.range.label.toLowerCase()}.`}
      >
        <ReportMetricsGrid>
          <ReportMetricCard
            metric={snapshot.overview.collected}
            href={BILLING_REPORT_DRILLDOWN.collected}
          />
          <ReportMetricCard
            metric={snapshot.overview.invoiced}
            href={BILLING_REPORT_DRILLDOWN.invoiced}
          />
          <ReportMetricCard
            metric={snapshot.overview.outstanding}
            href={BILLING_REPORT_DRILLDOWN.outstanding}
          />
          <ReportMetricCard
            metric={snapshot.overview.overdue}
            href={BILLING_REPORT_DRILLDOWN.overdue}
          />
          <ReportMetricCard
            metric={snapshot.overview.activeMrr}
            href={BILLING_REPORT_DRILLDOWN.activeMrr}
          />
          <ReportMetricCard
            metric={snapshot.overview.pendingSetup}
            href={BILLING_REPORT_DRILLDOWN.pendingSetup}
          />
          <ReportMetricCard
            metric={snapshot.overview.activeSubscriptions}
            href={BILLING_REPORT_DRILLDOWN.activeSubscriptions}
          />
        </ReportMetricsGrid>
      </ReportSection>

      <ReportChartCard title="Billing activity">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading chart…
          </p>
        ) : !hasChartData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No billing activity in this period yet.
          </p>
        ) : (
          <div className="h-[280px] min-h-[200px] sm:h-[320px]">
            <ResponsiveBar
              data={chartData}
              keys={["Collected", "Invoiced", "Recurring"]}
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
