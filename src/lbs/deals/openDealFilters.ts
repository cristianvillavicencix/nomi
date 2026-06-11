import { statusInFilter } from "@/lbs/shared/relatedFilters";

export const CLOSED_DEAL_STAGE_IDS = [
  "closed_won",
  "closed_lost",
  "won",
  "delivered",
] as const;

export const getOpenDealStageIds = (
  dealPipelineStatuses: string[],
  dealStages: Array<{ value: string }>,
): string[] => {
  const closedSet = new Set([
    ...dealPipelineStatuses,
    ...CLOSED_DEAL_STAGE_IDS,
  ]);
  return dealStages
    .map((stage) => stage.value)
    .filter((stageId) => !closedSet.has(stageId));
};

export const buildOpenDealsFilter = (
  dealPipelineStatuses: string[],
  dealStages: Array<{ value: string }>,
  baseFilter: Record<string, unknown>,
) => {
  const openStages = getOpenDealStageIds(dealPipelineStatuses, dealStages);
  if (openStages.length === 0) {
    return baseFilter;
  }
  return {
    ...baseFilter,
    "stage@in": statusInFilter(openStages),
  };
};
