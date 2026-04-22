import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DealPipelineStage } from "../types";

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
) => {
  const ratio = total <= 1 ? 1 : index / (total - 1);
  const hue = 216;

  if (state === "active") {
    const lightness = 44 - ratio * 8;
    return `hsl(${hue} 78% ${lightness}%)`;
  }

  if (state === "completed") {
    const lightness = 74 - ratio * 22;
    return `hsl(${hue} 72% ${lightness}%)`;
  }

  return "hsl(220 16% 90%)";
};

const getTextColor = (state: StageVisualState) => {
  if (state === "pending") return "hsl(220 18% 36%)";
  return "hsl(0 0% 100%)";
};

const getSegmentClipPath = (index: number, total: number) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (isFirst && isLast) {
    return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  }
  if (isFirst) {
    return "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)";
  }
  if (isLast) {
    return "polygon(0 0, 100% 0, 100% 100%, 0 100%, 18px 50%)";
  }
  return "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)";
};

export const ProjectStageFlow = ({
  stages,
  currentStage,
  onStageChange,
}: {
  stages: DealPipelineStage[];
  currentStage?: string;
  onStageChange?: (stageId: string) => void;
}) => {
  if (!stages.length) return null;

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
    <div className="mb-4 w-full rounded-xl bg-card p-2.5">
      <div className="overflow-x-auto pb-0.5">
        <div className="flex min-w-[680px] w-full items-stretch">
          <TooltipProvider>
            {stages.map((stage, index) => {
              const state = getStageVisualState(index, activeIndex);
              const background = getProgressColor(index, stages.length, state);
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

              return (
                <Tooltip key={stage.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => canChangeToStage && onStageChange?.(stage.id)}
                      disabled={!canChangeToStage}
                      className={`relative h-12 flex-1 min-w-[140px] px-6 text-left text-sm font-medium transition-all duration-300 ${
                        canChangeToStage
                          ? "cursor-pointer hover:brightness-95"
                          : "cursor-default"
                      }`}
                      style={{
                        clipPath,
                        marginLeft: index === 0 ? 0 : -10,
                        zIndex: stages.length - index,
                        background,
                        color: textColor,
                        transform:
                          isCurrent && isAnimating ? "translateY(-1px) scale(1.01)" : "none",
                        boxShadow:
                          state === "active"
                            ? isAnimating
                              ? "inset 0 0 0 2px rgba(255,255,255,0.72), 0 8px 18px rgba(10,20,40,0.20)"
                              : "inset 0 0 0 2px rgba(255,255,255,0.65), 0 3px 8px rgba(10,20,40,0.16)"
                            : "inset 0 0 0 1px rgba(255,255,255,0.35)",
                      }}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <span className="line-clamp-1">{stage.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="space-y-1">
                    <div className="font-medium">{stage.label}</div>
                    <div>Stage {index + 1} of {stages.length}</div>
                    <div>Status: {statusLabel}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: background }}
                      />
                      <span>Flow color</span>
                    </div>
                    {interactive ? <div>Click to move project here</div> : null}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
