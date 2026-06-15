import { ResponsiveBar } from "@nivo/bar";
import { format, parseISO, startOfMonth } from "date-fns";
import { DollarSign } from "lucide-react";
import { useGetList } from "ra-core";
import { memo, useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import type { Deal } from "../types";

// Probability weights for non-terminal LBS pipeline stages.
// Sales funnel stages get fractional weights; delivery stages (post-payment) count fully
// since the money is committed. Stages absent here weight 0 (no pending contribution).
const STAGE_PIPELINE_WEIGHT: Record<string, number> = {
  lead: 0.1,
  discovery: 0.25,
  proposal_sent: 0.5,
  pending_payment: 0.85,
  design: 1,
  development: 1,
  review: 1,
  launch: 1,
  maintenance: 1,
};

const WON_STAGES = new Set(["won", "closed_won"]);
const LOST_STAGES = new Set(["lost", "closed_lost"]);

const MONTHS_WINDOW = 6;
const sixMonthsAgo = new Date(
  new Date().setMonth(new Date().getMonth() - MONTHS_WINDOW),
).toISOString();

const DEFAULT_LOCALE = "en-US";
const CURRENCY = "USD";

const ChartHeader = () => (
  <div className="mb-4 flex items-center">
    <div className="mr-3 flex">
      <DollarSign className="h-6 w-6 text-muted-foreground" />
    </div>
    <h2 className="text-xl font-semibold text-muted-foreground">
      Upcoming Project Revenue
    </h2>
  </div>
);

export const DealsChart = memo(() => {
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 100, page: 1 },
    sort: {
      field: "created_at",
      order: "ASC",
    },
    filter: {
      "created_at@gte": sixMonthsAgo,
    },
  });

  const months = useMemo(() => {
    if (!data) return [];
    const dealsByMonth = data.reduce<Record<string, Deal[]>>((acc, deal) => {
      const month = startOfMonth(deal.created_at ?? new Date()).toISOString();
      if (!acc[month]) acc[month] = [];
      acc[month].push(deal);
      return acc;
    }, {});

    return Object.keys(dealsByMonth).map((month) => ({
      date: format(parseISO(month), "MMM"),
      won: dealsByMonth[month]
        .filter((deal) => WON_STAGES.has(deal.stage))
        .reduce((acc, deal) => acc + (Number(deal.amount) || 0), 0),
      pending: dealsByMonth[month]
        .filter(
          (deal) =>
            !WON_STAGES.has(deal.stage) && !LOST_STAGES.has(deal.stage),
        )
        .reduce((acc, deal) => {
          const weight = STAGE_PIPELINE_WEIGHT[deal.stage] ?? 0;
          return acc + (Number(deal.amount) || 0) * weight;
        }, 0),
      lost: dealsByMonth[month]
        .filter((deal) => LOST_STAGES.has(deal.stage))
        .reduce((acc, deal) => acc - (Number(deal.amount) || 0), 0),
    }));
  }, [data]);

  if (isPending) {
    return (
      <div className="flex flex-col">
        <ChartHeader />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="flex flex-col">
        <ChartHeader />
        <p className="text-sm text-muted-foreground">
          No deals in the last {MONTHS_WINDOW} months.
        </p>
      </div>
    );
  }

  const range = months.reduce(
    (acc, month) => {
      const w = Number(month.won) || 0;
      const p = Number(month.pending) || 0;
      const l = Number(month.lost) || 0;
      acc.min = Math.min(acc.min, l);
      acc.max = Math.max(acc.max, w + p, Math.abs(l));
      return acc;
    },
    { min: 0, max: 0 },
  );

  // Nivo/d3 need a non-degenerate domain (min === max yields NaN bar geometry)
  const scaleMin = range.min * 1.2;
  let scaleMax = range.max * 1.2;
  if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) {
    return (
      <div className="flex flex-col">
        <ChartHeader />
        <p className="text-sm text-muted-foreground">No data to display.</p>
      </div>
    );
  }
  if (scaleMax <= scaleMin) {
    scaleMax = scaleMin + 1;
  }

  const axisTextStyle = {
    ticks: { text: { fill: "var(--color-muted-foreground)" } },
    legend: { text: { fill: "var(--color-muted-foreground)" } },
  };

  return (
    <div className="flex flex-col">
      <ChartHeader />
      <div className="h-[400px]">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "lost"]}
          colors={[
            "var(--color-chart-2)",
            "var(--color-chart-1)",
            "var(--destructive)",
          ]}
          margin={{ top: 30, right: 50, bottom: 30, left: 0 }}
          padding={0.3}
          valueScale={{
            type: "linear",
            min: scaleMin,
            max: scaleMax,
          }}
          indexScale={{ type: "band", round: true }}
          enableGridX={true}
          enableGridY={false}
          enableLabel={false}
          tooltip={({ value, indexValue }) => (
            <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
              <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
              {value.toLocaleString(acceptedLanguages.at(0) ?? DEFAULT_LOCALE, {
                style: "currency",
                currency: CURRENCY,
              })}
            </div>
          )}
          axisTop={{
            tickSize: 0,
            tickPadding: 12,
            style: axisTextStyle,
          }}
          axisBottom={{
            legendPosition: "middle",
            legendOffset: 50,
            tickSize: 0,
            tickPadding: 12,
            style: axisTextStyle,
          }}
          axisLeft={null}
          axisRight={{
            format: (v: number) => `${Math.abs(v / 1000)}k`,
            tickValues: 8,
            style: axisTextStyle,
          }}
          markers={
            [
              {
                axis: "y",
                value: 0,
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "var(--color-chart-2)" },
                legend: "Won",
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: {
                  stroke: "var(--destructive)",
                  strokeWidth: 1,
                },
                textStyle: { fill: "var(--destructive)" },
                legend: "Lost",
                legendPosition: "bottom-left",
                legendOrientation: "vertical",
              },
            ] as never
          }
        />
      </div>
    </div>
  );
});
