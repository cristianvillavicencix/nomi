import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getProgressBarClassName } from "@/lbs/deals/projectTabProgress";

type BriefProgressBarProps = {
  percent: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export const BriefProgressBar = ({
  percent,
  className,
  barClassName,
  showLabel = false,
  size = "md",
}: BriefProgressBarProps) => {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Progress
        value={clamped}
        className={cn(
          size === "sm" ? "h-0.5 w-full" : "h-2 flex-1",
          getProgressBarClassName(clamped),
          barClassName,
        )}
      />
      {showLabel ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {clamped}%
        </span>
      ) : null}
    </div>
  );
};

export const BriefTabProgress = ({ percent }: { percent: number }) => (
  <BriefProgressBar
    percent={percent}
    size="sm"
    className="w-full min-w-[72px] max-w-[88px]"
  />
);

/** @deprecated Use BriefTabProgress */
export const TabProgressIndicator = BriefTabProgress;
