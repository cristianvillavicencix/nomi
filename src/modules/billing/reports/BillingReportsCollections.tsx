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
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const BillingReportsCollections = ({
  snapshot,
  isPending,
}: {
  snapshot: BillingReportsSnapshot;
  isPending: boolean;
}) => {
  const chartData = snapshot.collectionsSeries.map((row) => ({
    label: row.label,
    Collected: row.collected,
    Outstanding: Math.max(row.invoiced - row.collected, 0),
  }));

  const agingTotal = snapshot.collectionsAging.reduce(
    (sum, bucket) => sum + bucket.amount,
    0,
  );

  return (
    <div className="space-y-6">
      <ReportSection description="Cash collected vs balances still open on sent invoices.">
        <ReportMetricsGrid>
          <ReportMetricCard
            metric={snapshot.overview.collected}
            href={BILLING_REPORT_DRILLDOWN.collected}
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
            metric={snapshot.overview.pendingSetup}
            href={BILLING_REPORT_DRILLDOWN.pendingSetup}
          />
        </ReportMetricsGrid>
      </ReportSection>

      <ReportChartCard title="Collections vs open balance">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading chart…
          </p>
        ) : (
          <div className="h-[280px] min-h-[200px] sm:h-[320px]">
            <ResponsiveBar
              data={chartData}
              keys={["Collected", "Outstanding"]}
              indexBy="label"
              groupMode="stacked"
              colors={["#16a34a", "#f59e0b"]}
              {...billingReportBarChartDefaults}
            />
          </div>
        )}
      </ReportChartCard>

      <ReportSection
        title="Aging summary"
        description="Open invoice balances grouped by days past due."
      >
        <div className="overflow-hidden rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Aging bucket</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.collectionsAging.map((bucket) => (
                <TableRow key={bucket.id} className="border-border/40">
                  <TableCell className="font-medium">{bucket.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {bucket.count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyText value={bucket.amount} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-border/40">
                <TableCell className="font-semibold">Total open</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {snapshot.collectionsAging.reduce(
                    (sum, bucket) => sum + bucket.count,
                    0,
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <MoneyText value={agingTotal} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </ReportSection>
    </div>
  );
};
