import {
  getBriefOverallStats,
  getBriefSectionStats,
  getVisibleBriefSections,
} from "@/lbs/deals/websiteBriefSchema";
import { getProjectDeliveryDate } from "@/lbs/deals/projectDeliveryDate";
import {
  lbsProjectStages,
  normalizeLbsProjectStage,
} from "@/lbs/deals/lbsProjectConstants";
import type { LbsDeal } from "@/lbs/types";

export const BRIEF_SETUP_FIELD_COUNT = 2;
export const BRIEF_MIN_PERCENT_TO_LEAVE_SETUP = 70;

export type ProjectBriefProgress = {
  filled: number;
  total: number;
  percent: number;
  setupFilled: number;
};

export const getProjectBriefProgress = (
  record: LbsDeal,
): ProjectBriefProgress => {
  const brief = record.website_brief ?? {};
  const overall = getBriefOverallStats(record.project_type, brief);
  const setupFilled =
    Number(Boolean(record.project_type)) +
    Number(Boolean(getProjectDeliveryDate(record)));
  const total = overall.total + BRIEF_SETUP_FIELD_COUNT;
  const filled = overall.filled + setupFilled;
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent, setupFilled };
};

export const getSectionProgressPercent = (filled: number, total: number) =>
  total > 0 ? Math.round((filled / total) * 100) : 0;

export { getProgressBarClassName as getBriefProgressBarClassName } from "@/lbs/deals/projectTabProgress";

export const getIncompleteBriefSections = (record: LbsDeal) => {
  const brief = record.website_brief ?? {};
  const incomplete: string[] = [];

  if (!record.project_type) incomplete.push("Project setup");
  if (!getProjectDeliveryDate(record)) incomplete.push("Delivery date");

  for (const section of getVisibleBriefSections(record.project_type)) {
    const stats = getBriefSectionStats(section, brief);
    if (stats.total > 0 && !stats.isComplete) {
      incomplete.push(section.title);
    }
  }

  return incomplete;
};

export const getBriefStageAdvanceCheck = (
  record: LbsDeal,
  nextStage: string,
) => {
  const progress = getProjectBriefProgress(record);
  const current = normalizeLbsProjectStage(record.stage);
  const next = normalizeLbsProjectStage(nextStage);
  const leavingSetup = current === "setup" && next !== "setup";

  if (!leavingSetup || progress.percent >= BRIEF_MIN_PERCENT_TO_LEAVE_SETUP) {
    return { allowed: true as const, progress };
  }

  const incomplete = getIncompleteBriefSections(record);
  return {
    allowed: false as const,
    progress,
    message: `Brief is ${progress.percent}% complete (${BRIEF_MIN_PERCENT_TO_LEAVE_SETUP}% required to leave Setup). Still missing: ${incomplete.slice(0, 4).join(", ")}${incomplete.length > 4 ? "…" : ""}.`,
  };
};

export const getStageOrder = (stage: string) =>
  lbsProjectStages.findIndex(
    (entry) => entry.value === normalizeLbsProjectStage(stage),
  );

export const mergeDealIntoIntakeValues = (
  deal: {
    project_type?: string | null;
    expected_end_date?: string | null;
    expected_closing_date?: string | null;
    website_brief?: Record<string, string | null | undefined> | null;
  },
  base: Record<string, string>,
) => {
  const next = { ...base };
  const brief = deal.website_brief ?? {};

  if (deal.project_type) {
    next.project_type = deal.project_type;
  }

  for (const [key, value] of Object.entries(brief)) {
    if (value != null && String(value).trim()) {
      next[key] = String(value);
    }
  }

  return next;
};
