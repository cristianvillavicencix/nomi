import type { DealResource } from "@/lbs/types";
import {
  getResourceTabCategory,
  PROJECT_RESOURCE_TAB_CATEGORIES,
  type ProjectResourceTabCategory,
} from "@/lbs/deals/projectResourceConstants";

export const groupResourcesByTabCategory = (resources: DealResource[]) => {
  const map = new Map<ProjectResourceTabCategory, DealResource[]>();
  for (const categoryDef of PROJECT_RESOURCE_TAB_CATEGORIES) {
    map.set(categoryDef.id, []);
  }
  for (const resource of resources) {
    const tabCategory = getResourceTabCategory(resource.category);
    const bucket = map.get(tabCategory) ?? [];
    bucket.push(resource);
    map.set(tabCategory, bucket);
  }
  return map;
};

/** @deprecated Use groupResourcesByTabCategory */
export const groupResourcesByCategory = groupResourcesByTabCategory;

export const groupServicePhotosByLabel = (resources: DealResource[]) => {
  const servicePhotos = resources.filter(
    (entry) => entry.category === "service-photo",
  );
  const groups = new Map<string, DealResource[]>();

  for (const resource of servicePhotos) {
    const label = resource.label?.trim() || "General";
    const bucket = groups.get(label) ?? [];
    bucket.push(resource);
    groups.set(label, bucket);
  }

  return Array.from(groups.entries()).sort(([left], [right]) =>
    left.localeCompare(right),
  );
};

export const getTabCategoryCounts = (resources: DealResource[]) => {
  const grouped = groupResourcesByTabCategory(resources);
  const counts: Record<string, number> = {};
  for (const categoryDef of PROJECT_RESOURCE_TAB_CATEGORIES) {
    counts[categoryDef.id] = grouped.get(categoryDef.id)?.length ?? 0;
  }
  return counts;
};

/** @deprecated Use getTabCategoryCounts */
export const getCategoryCounts = getTabCategoryCounts;

export const formatResourceDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
