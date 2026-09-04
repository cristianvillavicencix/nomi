import type { DealPipelineStage } from "@/components/atomic-crm/types";
import {
  buildLbsDealPipelineStages,
  getLbsStageColor,
  lbsProjectStages,
  normalizeLbsProjectStage,
} from "@/modules/deals/lbsProjectConstants";

/**
 * Project show header pipeline — 1:1 with kanban stages (9-stage web pipeline).
 */
export const LBS_PROJECT_DISPLAY_STAGES = lbsProjectStages.map((stage) => ({
  id: stage.value,
  label: stage.label,
  stageIds: [stage.value] as readonly string[],
  targetStage: stage.value,
}));

export type LbsProjectDisplayStageId =
  (typeof LBS_PROJECT_DISPLAY_STAGES)[number]["id"];

const displayStageById = Object.fromEntries(
  LBS_PROJECT_DISPLAY_STAGES.map((stage) => [stage.id, stage]),
) as Record<
  LbsProjectDisplayStageId,
  (typeof LBS_PROJECT_DISPLAY_STAGES)[number]
>;

export const getProjectDisplayPipelineStages = (): DealPipelineStage[] =>
  buildLbsDealPipelineStages().map((stage) => ({
    ...stage,
    color: getLbsStageColor(stage.id),
  }));

export const getProjectDisplayStageForDealStage = (
  dealStage?: string | null,
): LbsProjectDisplayStageId => {
  const normalized = normalizeLbsProjectStage(dealStage);
  const match = LBS_PROJECT_DISPLAY_STAGES.find((entry) =>
    (entry.stageIds as readonly string[]).includes(normalized),
  );
  return (match?.id ?? "lead") as LbsProjectDisplayStageId;
};

export const resolveProjectDisplayStageChange = (
  displayStageId: string,
  currentDealStage?: string | null,
): string => {
  const entry =
    displayStageById[displayStageId as LbsProjectDisplayStageId] ??
    LBS_PROJECT_DISPLAY_STAGES[0];
  const normalizedCurrent = normalizeLbsProjectStage(currentDealStage);
  if ((entry.stageIds as readonly string[]).includes(normalizedCurrent)) {
    return normalizedCurrent;
  }
  return entry.targetStage;
};

export const getProjectDisplayStageLabel = (dealStage?: string | null) => {
  const displayId = getProjectDisplayStageForDealStage(dealStage);
  return displayStageById[displayId]?.label ?? dealStage ?? "";
};
