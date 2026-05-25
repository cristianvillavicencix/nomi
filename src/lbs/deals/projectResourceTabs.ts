import type { DealResource } from "@/lbs/types";
import {
  buildServiceCategory,
  formatServiceCategoryLabel,
  parseServiceCategorySlug,
  PROJECT_RESOURCE_TAB_CATEGORIES,
  type ProjectResourceTabCategory,
} from "@/lbs/deals/projectResourceConstants";

export type ProjectResourceTabDef = {
  id: string;
  label: string;
  description: string;
  kind: "base" | "service";
  /** Value stored on deal_resources.category */
  category: string;
};

const mainTabById = Object.fromEntries(
  PROJECT_RESOURCE_TAB_CATEGORIES.map((entry) => [entry.id, entry]),
);

/** Top-level Assets tabs: Logos, Photo services, Team, Documents, Other. */
export const buildMainResourceTabs = (): ProjectResourceTabDef[] =>
  PROJECT_RESOURCE_TAB_CATEGORIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    kind: "base" as const,
    category: entry.id,
  }));

/** Sub-tabs inside Photo services — one per service category. */
export const buildServiceSubTabs = (
  resources: DealResource[],
  extraServiceSlugs: string[] = [],
): ProjectResourceTabDef[] => {
  const serviceSlugs = new Set<string>();

  for (const resource of resources) {
    const slug = parseServiceCategorySlug(resource.category);
    if (slug) serviceSlugs.add(slug);
  }
  for (const slug of extraServiceSlugs) {
    if (slug.trim()) serviceSlugs.add(slug.trim());
  }

  return Array.from(serviceSlugs)
    .sort((left, right) =>
      formatServiceCategoryLabel(left).localeCompare(
        formatServiceCategoryLabel(right),
      ),
    )
    .map(
      (slug): ProjectResourceTabDef => ({
        id: buildServiceCategory(slug),
        label: formatServiceCategoryLabel(slug),
        description: `Photos for ${formatServiceCategoryLabel(slug).toLowerCase()}.`,
        kind: "service",
        category: buildServiceCategory(slug),
      }),
    );
};

export const getResourcesForMainTab = (
  tabId: ProjectResourceTabCategory,
  resources: DealResource[],
) => {
  if (tabId === "service-photo") {
    return resources.filter((entry) =>
      Boolean(parseServiceCategorySlug(entry.category)),
    );
  }
  if (tabId === "other") {
    return resources.filter((entry) => {
      if (parseServiceCategorySlug(entry.category)) return false;
      return !PROJECT_RESOURCE_TAB_CATEGORIES.some(
        (def) => def.id !== "other" && def.id === entry.category,
      );
    });
  }
  return resources.filter((entry) => entry.category === tabId);
};

export const getResourcesForServiceSubTab = (
  tab: ProjectResourceTabDef,
  resources: DealResource[],
) => resources.filter((entry) => entry.category === tab.category);

export const getMainTabCounts = (resources: DealResource[]) => {
  const counts: Record<string, number> = {};
  for (const def of PROJECT_RESOURCE_TAB_CATEGORIES) {
    counts[def.id] = getResourcesForMainTab(def.id, resources).length;
  }
  return counts;
};

export const getServiceSubTabCounts = (
  serviceTabs: ProjectResourceTabDef[],
  resources: DealResource[],
) => {
  const counts: Record<string, number> = {};
  for (const tab of serviceTabs) {
    counts[tab.id] = getResourcesForServiceSubTab(tab, resources).length;
  }
  return counts;
};

export const pendingTabsStorageKey = (dealId: string | number) =>
  `nomi:deal-resource-tabs:${dealId}`;

export const readPendingServiceSlugs = (dealId: string | number) => {
  try {
    const raw = localStorage.getItem(pendingTabsStorageKey(dealId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
};

export const writePendingServiceSlugs = (
  dealId: string | number,
  slugs: string[],
) => {
  try {
    localStorage.setItem(
      pendingTabsStorageKey(dealId),
      JSON.stringify(slugs),
    );
  } catch {
    // ignore quota errors
  }
};

/** @deprecated Use buildMainResourceTabs + buildServiceSubTabs */
export const buildProjectResourceTabs = buildMainResourceTabs;

/** @deprecated */
export const getResourcesForTab = getResourcesForMainTab;
