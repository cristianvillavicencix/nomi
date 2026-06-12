import type { DealStage } from "../types";
import { getLbsProjectStageLabel } from "@/modules/deals/lbsProjectConstants";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const fromConfig = dealStages.find(
    (dealStage) => dealStage.value === dealValue,
  )?.label;
  if (fromConfig) return fromConfig;
  return getLbsProjectStageLabel(dealValue);
};
