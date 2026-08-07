import type { BarTooltipProps } from "@nivo/bar";

export const billingReportChartMargin = {
  top: 20,
  right: 20,
  bottom: 50,
  left: 56,
};

export const billingReportChartTheme = {
  axis: {
    ticks: {
      text: {
        fontSize: 11,
      },
    },
    legend: {
      text: {
        fontSize: 11,
      },
    },
  },
  grid: {
    line: {
      stroke: "hsl(var(--border))",
      strokeWidth: 1,
    },
  },
};

const formatTooltipMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const BillingReportBarTooltip = ({
  id,
  value,
  indexValue,
  color,
}: BarTooltipProps<number>) => (
  <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
    <div className="font-medium">{indexValue}</div>
    <div className="mt-1 flex items-center gap-2">
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{id}</span>
      <span className="font-semibold tabular-nums">
        {formatTooltipMoney(Number(value))}
      </span>
    </div>
  </div>
);

export const billingReportBarChartDefaults = {
  margin: billingReportChartMargin,
  padding: 0.3,
  enableLabel: false,
  axisBottom: { tickRotation: -35 },
  theme: billingReportChartTheme,
  tooltip: BillingReportBarTooltip,
};
