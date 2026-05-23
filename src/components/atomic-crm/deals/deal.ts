import type { DealStage } from "../types";
import { getLbsProjectStageLabel } from "@/lbs/deals/lbsProjectConstants";
import { isLbsMode } from "@/lbs/productMode";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  const fromConfig = dealStages.find(
    (dealStage) => dealStage.value === dealValue,
  )?.label;
  if (fromConfig) return fromConfig;
  if (isLbsMode()) return getLbsProjectStageLabel(dealValue);
  return dealValue;
};
