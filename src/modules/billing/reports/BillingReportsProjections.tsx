import { useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import type { BillingReportsSnapshot } from "@/modules/billing/reports/billingReportsAggregation";
import type { BillingReportScenarioAssumptions } from "@/modules/billing/reports/billingReportProjections";
import { ReportChartCard, ReportSection } from "@/modules/billing/reports/ReportUi";
import { billingReportBarChartDefaults } from "@/modules/billing/reports/reportChartUtils";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BillingReportsProjectionsProps = {
  snapshot: BillingReportsSnapshot;
  isPending: boolean;
  scenario: BillingReportScenarioAssumptions;
  onScenarioChange: (scenario: BillingReportScenarioAssumptions) => void;
};

export const BillingReportsProjections = ({
  snapshot,
  isPending,
  scenario,
  onScenarioChange,
}: BillingReportsProjectionsProps) => {
  const rows = snapshot.scenarioProjections ?? [];

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        label: row.label,
        Baseline: row.baselineMrr,
        Conservative: row.conservativeMrr,
        Growth: row.growthMrr,
      })),
    [rows],
  );

  const updateScenario = (
    key: keyof BillingReportScenarioAssumptions,
    value: string,
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onScenarioChange({
      ...scenario,
      [key]: parsed,
    });
  };

  return (
    <div className="space-y-6">
      <ReportSection description="Forward-looking outlook from active subscriptions. Adjust assumptions to compare scenarios.">
        <div className="grid gap-4 rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.05] md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="report-churn-rate">Monthly churn rate (%)</Label>
            <Input
              id="report-churn-rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={scenario.churnRatePercent}
              onChange={(event) =>
                updateScenario("churnRatePercent", event.target.value)
              }
              className="border-0 bg-background/80 shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-new-subs">New subscriptions / month</Label>
            <Input
              id="report-new-subs"
              type="number"
              min={0}
              step={1}
              value={scenario.newSubsPerMonth}
              onChange={(event) =>
                updateScenario("newSubsPerMonth", event.target.value)
              }
              className="border-0 bg-background/80 shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-new-mrr">Avg new MRR / subscription</Label>
            <Input
              id="report-new-mrr"
              type="number"
              min={0}
              step={0.01}
              value={scenario.avgNewMrr}
              onChange={(event) =>
                updateScenario("avgNewMrr", event.target.value)
              }
              className="border-0 bg-background/80 shadow-none"
            />
          </div>
        </div>
      </ReportSection>

      <ReportChartCard title="Next 6 months">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading chart…
          </p>
        ) : (
          <div className="h-[280px] min-h-[200px] sm:h-[320px]">
            <ResponsiveBar
              data={chartData}
              keys={["Baseline", "Conservative", "Growth"]}
              indexBy="label"
              groupMode="grouped"
              colors={["#2563eb", "#f59e0b", "#16a34a"]}
              {...billingReportBarChartDefaults}
            />
          </div>
        )}
      </ReportChartCard>

      <div className="overflow-hidden rounded-2xl bg-black/[0.025] dark:bg-white/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Active subs</TableHead>
              <TableHead className="text-right">Baseline MRR</TableHead>
              <TableHead className="text-right">Conservative MRR</TableHead>
              <TableHead className="text-right">Growth MRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-border/40">
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No projection rows for this scenario.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.monthKey} className="border-border/40">
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeSubscriptions}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyText value={row.baselineMrr} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyText value={row.conservativeMrr} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MoneyText value={row.growthMrr} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
