import type { DataProvider, Identifier } from "ra-core";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";

export type LaunchChecklistBlocker = {
  incompleteRequired: number;
  message: string;
};

export const getLaunchChecklistBlocker = async (
  dataProvider: DataProvider,
  dealId: Identifier,
): Promise<LaunchChecklistBlocker | null> => {
  const { data = [], total = 0 } = await dataProvider.getList(
    "deal_launch_checklist_items",
    {
      filter: {
        "deal_id@eq": dealId,
        "is_required@eq": true,
        "is_completed@eq": false,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "order_index", order: "ASC" },
    },
  );

  if (total === 0 && data.length === 0) {
    return null;
  }

  const incompleteRequired = total || data.length;
  if (incompleteRequired <= 0) return null;

  return {
    incompleteRequired,
    message: `${incompleteRequired} required launch checklist item${incompleteRequired === 1 ? "" : "s"} still incomplete. Open the Launch tab to finish them before moving to Launch.`,
  };
};

export const getLaunchStageAdvanceCheck = async (
  dataProvider: DataProvider,
  dealId: Identifier,
  nextStage: string,
) => {
  const normalized = normalizeLbsProjectStage(nextStage);
  if (normalized !== "launch") {
    return { allowed: true as const };
  }

  const blocker = await getLaunchChecklistBlocker(dataProvider, dealId);
  if (!blocker) {
    return { allowed: true as const };
  }

  return {
    allowed: false as const,
    message: blocker.message,
  };
};
