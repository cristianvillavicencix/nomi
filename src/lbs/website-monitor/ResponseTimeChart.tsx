import { ResponsiveBar } from "@nivo/bar";
import type { WebsiteCheck } from "@/lbs/website-monitor/types";

export const ResponseTimeChart = ({
  checks,
  slowThresholdMs,
}: {
  checks: WebsiteCheck[];
  slowThresholdMs: number;
}) => {
  const chartData = [...checks]
    .reverse()
    .slice(-40)
    .map((check) => ({
      time: new Date(check.checked_at).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ms: check.response_ms ?? 0,
    }));

  if (!chartData.length) {
    return (
      <p className="text-sm text-muted-foreground">No check history yet.</p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveBar
        data={chartData}
        keys={["ms"]}
        indexBy="time"
        margin={{ top: 8, right: 12, bottom: 28, left: 44 }}
        padding={0.35}
        colors={["#38bdf8"]}
        axisBottom={{ tickRotation: -35 }}
        axisLeft={{ legend: "ms", legendOffset: -36, legendPosition: "middle" }}
        enableLabel={false}
        markers={[
          {
            axis: "y",
            value: slowThresholdMs,
            lineStyle: {
              stroke: "#eab308",
              strokeWidth: 2,
              strokeDasharray: "4 4",
            },
            legend: "Slow threshold",
            legendOrientation: "horizontal",
            legendPosition: "top-right",
          },
        ]}
        theme={{
          text: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
          axis: {
            ticks: {
              text: { fill: "hsl(var(--muted-foreground))", fontSize: 10 },
            },
          },
          grid: { line: { stroke: "hsl(var(--border))", strokeOpacity: 0.5 } },
        }}
      />
    </div>
  );
};
