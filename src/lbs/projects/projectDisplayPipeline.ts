import type { DealPipelineStage } from "@/components/atomic-crm/types";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";

/** Compact project detail pipeline — max 7 steps for the show page header. */
export const LBS_PROJECT_DISPLAY_STAGES = [
  {
    id: "lead",
    label: "Lead",
    stageIds: ["lead", "discovery"],
    targetStage: "lead",
  },
  {
    id: "proposal",
    label: "Proposal",
    stageIds: ["proposal_sent"],
    targetStage: "proposal_sent",
  },
  {
    id: "won",
    label: "Won",
    stageIds: ["won"],
    targetStage: "won",
  },
  {
    id: "production",
    label: "Build",
    stageIds: ["design", "development"],
    targetStage: "design",
  },
  {
    id: "review",
    label: "Review",
    stageIds: ["review"],
    targetStage: "review",
  },
  {
    id: "launch",
    label: "Launch",
    stageIds: ["launch", "maintenance"],
    targetStage: "launch",
  },
  {
    id: "closed",
    label: "Closed",
    stageIds: ["closed_won", "closed_lost"],
    targetStage: "closed_won",
  },
] as const;

export type LbsProjectDisplayStageId =
  (typeof LBS_PROJECT_DISPLAY_STAGES)[number]["id"];

const displayStageById = Object.fromEntries(
  LBS_PROJECT_DISPLAY_STAGES.map((stage) => [stage.id, stage]),
) as Record<LbsProjectDisplayStageId, (typeof LBS_PROJECT_DISPLAY_STAGES)[number]>;

export const getProjectDisplayPipelineStages = (): DealPipelineStage[] =>
  LBS_PROJECT_DISPLAY_STAGES.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    color: "#64748b",
    order: index + 1,
    pipelineId: "display",
    isDefault: stage.id === "lead",
  }));

export const getProjectDisplayStageForDealStage = (
  dealStage?: string | null,
): LbsProjectDisplayStageId => {
  const normalized = normalizeLbsProjectStage(dealStage);
  const match = LBS_PROJECT_DISPLAY_STAGES.find((entry) =>
    (entry.stageIds as readonly string[]).includes(normalized),
  );
  return match?.id ?? "lead";
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
