import { useEffect, useState, type CSSProperties } from "react";
import type { DealPipelineStage } from "../types";
import { cn } from "@/lib/utils";

type StageVisualState = "completed" | "active" | "pending";

const getActiveIndex = (stages: DealPipelineStage[], currentStage?: string) => {
  const index = stages.findIndex((stage) => stage.id === currentStage);
  return index >= 0 ? index : 0;
};

const getStageVisualState = (
  index: number,
  activeIndex: number,
): StageVisualState => {
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "active";
  return "pending";
};

const getProgressColor = (
  index: number,
  total: number,
  state: StageVisualState,
  stageId: string,
) => {
  // Lost is off the happy path — keep it clearly red when reached.
  if (stageId === "closed_lost") {
    if (state === "pending") return "hsl(220 16% 90%)";
    if (state === "active") return "hsl(0 72% 46%)";
    return "hsl(0 58% 60%)";
  }

  // Same cool → warm arc as the project calendar (sky → amber toward delivery/close).
  // Closed is the warm cap; ignore Lost in the ratio.
  const progressSteps = Math.max(total - 2, 1);
  const cappedIndex = Math.min(index, progressSteps);
  const ratio = cappedIndex / progressSteps;
  const hue = 198 - ratio * 160;

  if (state === "active") {
    return `hsl(${hue} 82% 44%)`;
  }

  if (state === "completed") {
    const lightness = 66 - ratio * 10;
    return `hsl(${hue} 72% ${lightness}%)`;
  }

  return "hsl(220 16% 90%)";
};

const getTextColor = (state: StageVisualState) => {
  if (state === "pending") return "hsl(220 18% 36%)";
  return "hsl(0 0% 100%)";
};

const CHEVRON_DEPTH = "var(--stage-chevron-depth, 18px)";

const getSegmentClipPath = (index: number, total: number) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (isFirst && isLast) {
    return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  }
  if (isFirst) {
    return `polygon(0 0, calc(100% - ${CHEVRON_DEPTH}) 0, 100% 50%, calc(100% - ${CHEVRON_DEPTH}) 100%, 0 100%)`;
  }
  if (isLast) {
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${CHEVRON_DEPTH} 50%)`;
  }
  return `polygon(0 0, calc(100% - ${CHEVRON_DEPTH}) 0, 100% 50%, calc(100% - ${CHEVRON_DEPTH}) 100%, 0 100%, ${CHEVRON_DEPTH} 50%)`;
};

const getSegmentTextPaddingClass = (index: number, total: number) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (isFirst && isLast) return "";
  if (isFirst) return "pr-[var(--stage-chevron-depth)]";
  if (isLast) return "pl-[var(--stage-chevron-depth)]";
  return "px-[calc(var(--stage-chevron-depth)*0.5)]";
};

export const ProjectStageFlow = (props: {
  stages: DealPipelineStage[];
  currentStage?: string;
  onStageChange?: (stageId: string) => void;
  className?: string;
}) => {
  if (!props.stages.length) return null;
  return <ProjectStageFlowInner {...props} />;
};

const ProjectStageFlowInner = ({
  stages,
  currentStage,
  onStageChange,
  className,
}: {
  stages: DealPipelineStage[];
  currentStage?: string;
  onStageChange?: (stageId: string) => void;
  className?: string;
}) => {
  const activeIndex = getActiveIndex(stages, currentStage);
  const interactive = typeof onStageChange === "function";
  const activeStageId = stages[activeIndex]?.id;
  const [animatedStageId, setAnimatedStageId] = useState<string | undefined>(
    activeStageId,
  );

  useEffect(() => {
    if (!activeStageId) return;
    setAnimatedStageId(activeStageId);
    const timeoutId = window.setTimeout(() => {
      setAnimatedStageId(undefined);
    }, 520);
    return () => window.clearTimeout(timeoutId);
  }, [activeStageId]);

  return (
    <div
      className={cn("mb-4 w-full rounded-xl bg-card p-2 sm:p-2.5", className)}
      style={
        {
          "--stage-chevron-depth": "clamp(8px, 2.2vw, 18px)",
        } as CSSProperties
      }
    >
      <div className="flex w-full min-w-0 items-stretch">
        {stages.map((stage, index) => {
          const state = getStageVisualState(index, activeIndex);
          const background = getProgressColor(
            index,
            stages.length,
            state,
            stage.id,
          );
          const textColor = getTextColor(state);
          const isCurrent = stage.id === stages[activeIndex]?.id;
          const canChangeToStage = interactive && !isCurrent;
          const clipPath = getSegmentClipPath(index, stages.length);
          const statusLabel =
            state === "completed"
              ? "Completed"
              : state === "active"
                ? "Current"
                : "Pending";
          const isAnimating = animatedStageId === stage.id;
          const tooltipLines = [
            `${stage.label} — Stage ${index + 1} of ${stages.length}`,
            `Status: ${statusLabel}`,
          ];
          if (interactive && canChangeToStage) {
            tooltipLines.push("Click to move project here");
          }

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => canChangeToStage && onStageChange?.(stage.id)}
              disabled={!canChangeToStage}
              className={cn(
                "relative flex h-9 min-w-0 flex-1 items-center justify-center px-1 text-[10px] font-medium transition-all duration-300 sm:h-11 sm:px-1.5 sm:text-xs md:h-12 md:text-sm",
                getSegmentTextPaddingClass(index, stages.length),
                canChangeToStage
                  ? "cursor-pointer hover:brightness-95"
                  : "cursor-default",
              )}
              style={{
                clipPath,
                marginLeft:
                  index === 0 ? 0 : "calc(var(--stage-chevron-depth) * -0.56)",
                zIndex: stages.length - index,
                background,
                color: textColor,
                transform:
                  isCurrent && isAnimating
                    ? "translateY(-1px) scale(1.01)"
                    : "none",
                boxShadow:
                  state === "active"
                    ? isAnimating
                      ? "inset 0 0 0 2px rgba(255,255,255,0.72), 0 8px 18px rgba(10,20,40,0.20)"
                      : "inset 0 0 0 2px rgba(255,255,255,0.65), 0 3px 8px rgba(10,20,40,0.16)"
                    : "inset 0 0 0 1px rgba(255,255,255,0.35)",
              }}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={tooltipLines.join(". ")}
              title={tooltipLines.join("\n")}
            >
              <span className="w-full truncate text-center leading-tight">
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
