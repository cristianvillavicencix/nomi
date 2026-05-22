import type { DealPipelineStage } from "../types";
import type { Deal } from "../types";
import { isLbsMode } from "@/lbs/productMode";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";

export type DealsByStage = Record<Deal["stage"], Deal[]>;

export const getDealsByStage = (
  unorderedDeals: Deal[],
  stages: DealPipelineStage[],
) => {
  if (!stages?.length) return {};
  const dealsByStage: Record<Deal["stage"], Deal[]> = unorderedDeals.reduce(
    (acc, deal) => {
      const normalizedStage = isLbsMode()
        ? normalizeLbsProjectStage(deal.stage)
        : deal.stage;
      // if deal has a stage that does not exist in configuration, assign it to the first stage
      const stage = stages.find((s) => s.id === normalizedStage)
        ? normalizedStage
        : stages[0].id;
      acc[stage].push({ ...deal, stage: normalizedStage });
      return acc;
    },
    stages.reduce(
      (obj, stage) => ({ ...obj, [stage.id]: [] }),
      {} as Record<Deal["stage"], Deal[]>,
    ),
  );
  // order each column by index
  stages.forEach((stage) => {
    dealsByStage[stage.id] = dealsByStage[stage.id].sort(
      (recordA: Deal, recordB: Deal) => recordA.index - recordB.index,
    );
  });
  return dealsByStage;
};
