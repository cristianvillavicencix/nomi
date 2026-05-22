import { getResourceTabCategory, PROJECT_RESOURCE_TAB_CATEGORIES } from "@/lbs/deals/projectResourceConstants";
import type { DealResource } from "@/lbs/types";

export type TabProgress = {
  filled: number;
  total: number;
  percent: number;
};

export const getProjectResourcesProgress = (
  resources: DealResource[],
): TabProgress => {
  const total = PROJECT_RESOURCE_TAB_CATEGORIES.length;
  const filledCategories = new Set<string>();

  for (const resource of resources) {
    filledCategories.add(getResourceTabCategory(resource.category));
  }

  const filled = filledCategories.size;
  const percent = Math.round((filled / total) * 100);
  return { filled, total, percent };
};

export const getProjectTasksProgress = (
  openCount: number,
  doneCount: number,
): TabProgress => {
  const total = openCount + doneCount;
  if (total === 0) {
    return { filled: 0, total: 0, percent: 100 };
  }
  const percent = Math.round((doneCount / total) * 100);
  return { filled: doneCount, total, percent };
};

export const getProgressBarClassName = (percent: number) => {
  if (percent >= 100) return "[&_[data-slot=progress-indicator]]:bg-emerald-600";
  if (percent >= 70) return "[&_[data-slot=progress-indicator]]:bg-sky-600";
  if (percent >= 40) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-muted-foreground/50";
};
