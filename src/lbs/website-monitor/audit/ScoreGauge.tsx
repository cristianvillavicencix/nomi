import { useEffect, useState } from "react";
import { MetricInfo } from "@/lbs/website-monitor/audit/MetricInfo";
import { METRIC_TOOLTIPS } from "@/lbs/website-monitor/audit/auditMetricTooltips";
import { cn } from "@/lib/utils";

export const scoreColorClass = (value: number) => {
  if (value >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

export const scoreRingClass = (value: number) => {
  if (value >= 90) return "stroke-emerald-500";
  if (value >= 50) return "stroke-amber-500";
  return "stroke-red-500";
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const ScoreGauge = ({
  label,
  value,
  size = "md",
  animate = true,
  tooltipKey,
  onClick,
}: {
  label: string;
  value?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  animate?: boolean;
  tooltipKey?: keyof typeof METRIC_TOOLTIPS | string;
  onClick?: () => void;
}) => {
  const target = value != null ? Math.max(0, Math.min(100, value)) : null;
  const [display, setDisplay] = useState(
    animate && target != null ? 0 : target,
  );

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

  const dims =
    size === "xl" ? 120 : size === "lg" ? 88 : size === "sm" ? 56 : 72;
  const stroke = size === "xl" || size === "lg" ? 6 : 5;
  const radius = (dims - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = display ?? 0;
  const pct = target != null ? shown : 0;
  const offset = circumference - (pct / 100) * circumference;
  const tooltip =
    tooltipKey && tooltipKey in METRIC_TOOLTIPS
      ? METRIC_TOOLTIPS[tooltipKey as keyof typeof METRIC_TOOLTIPS]
      : undefined;

  const gauge = (
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
          size === "xl"
            ? "text-4xl"
            : size === "lg"
              ? "text-2xl"
              : size === "sm"
                ? "text-sm"
                : "text-lg"
        } ${target != null ? scoreColorClass(shown) : "text-muted-foreground"}`}
      >
        {target != null ? shown : "—"}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "cursor-pointer rounded-lg transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          {gauge}
        </button>
      ) : (
        gauge
      )}
      {label ? (
        <div className="flex max-w-[6rem] items-center justify-center gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {tooltip ? <MetricInfo text={tooltip} /> : null}
        </div>
      ) : tooltip ? (
        <MetricInfo text={tooltip} />
      ) : null}
      {onClick ? (
        <span className="text-[10px] text-primary/80">Ver detalle →</span>
      ) : null}
    </div>
  );
};
