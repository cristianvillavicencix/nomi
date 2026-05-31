import { useEffect, useState } from "react";
import { MetricInfo } from "@/lbs/website-monitor/audit/MetricInfo";
import { METRIC_TOOLTIPS } from "@/lbs/website-monitor/audit/auditMetricTooltips";
import {
  formatLabMetric,
  labMetricScore,
  type LabMetricKey,
} from "@/lbs/website-monitor/audit/labMetricUtils";
import {
  scoreColorClass,
  scoreRingClass,
} from "@/lbs/website-monitor/audit/ScoreGauge";

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const LabMetricGauge = ({
  metric,
  value,
  label,
  size = "md",
  animate = true,
}: {
  metric: LabMetricKey;
  value?: number | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}) => {
  const score = labMetricScore(metric, value);
  const displayText = formatLabMetric(metric, value);
  const target = score;
  const [display, setDisplay] = useState(animate && target != null ? 0 : target);

  useEffect(() => {
    if (!animate || target == null) {
      setDisplay(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(target * easeOutCubic(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target]);

  const dims = size === "lg" ? 88 : size === "sm" ? 56 : 72;
  const stroke = size === "lg" ? 6 : 5;
  const radius = (dims - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = display ?? 0;
  const pct = target != null ? shown : 0;
  const offset = circumference - (pct / 100) * circumference;
  const tooltip = METRIC_TOOLTIPS[metric];
  const gaugeLabel = label ?? metric.toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative" style={{ width: dims, height: dims }}>
        <svg width={dims} height={dims} className="-rotate-90">
          <circle
            cx={dims / 2}
            cy={dims / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted/40"
          />
          {target != null ? (
            <circle
              cx={dims / 2}
              cy={dims / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`transition-[stroke-dashoffset] duration-150 ${scoreRingClass(shown)}`}
            />
          ) : null}
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${
            size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm"
          } ${target != null ? scoreColorClass(shown) : "text-muted-foreground"}`}
        >
          {displayText}
        </span>
      </div>
      <div className="flex max-w-[6rem] items-center justify-center gap-0.5">
        <span className="text-xs text-muted-foreground">{gaugeLabel}</span>
        {tooltip ? <MetricInfo text={tooltip} /> : null}
      </div>
    </div>
  );
};
