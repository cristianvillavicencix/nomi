import type { Identifier } from "ra-core";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";

export type WebsiteMonitorSortOrder = "activity" | "name" | "newest";

export const DEFAULT_WEBSITE_MONITOR_SORT: WebsiteMonitorSortOrder = "name";

const SORT_STORAGE_KEY = "web_monitor_sort_order";

const isSortOrder = (value: string | null): value is WebsiteMonitorSortOrder =>
  value === "activity" || value === "name" || value === "newest";

export const getPersistedSortOrder = (): WebsiteMonitorSortOrder => {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (isSortOrder(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_WEBSITE_MONITOR_SORT;
};

export const persistSortOrder = (order: WebsiteMonitorSortOrder) => {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, order);
  } catch {
    // ignore
  }
};

export const WEBSITE_MONITOR_SORT_LABELS: Record<
  WebsiteMonitorSortOrder,
  string
> = {
  activity: "Actividad reciente",
  name: "Nombre (A → Z)",
  newest: "Recién agregados",
};

const siteDisplayName = (site: MonitoredWebsite) =>
  (site.display_name || site.company_name || site.url || "").trim();

export const sortMonitoredWebsites = (
  sites: MonitoredWebsite[],
  order: WebsiteMonitorSortOrder,
): MonitoredWebsite[] => {
  const copy = [...sites];

  if (order === "name") {
    return copy.sort((a, b) =>
      siteDisplayName(a).localeCompare(siteDisplayName(b), "es", {
        sensitivity: "base",
      }),
    );
  }

  if (order === "newest") {
    return copy.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }

  return copy.sort((a, b) => {
    const ta = a.last_checked_at ? new Date(a.last_checked_at).getTime() : 0;
    const tb = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0;
    return tb - ta;
  });
};

/** Survives route changes within the same tab — avoids list jumping on remount. */
let sessionStableOrder: Identifier[] | null = null;
let sessionSortOrder: WebsiteMonitorSortOrder | null = null;

/**
 * Keeps row order stable when site metrics refresh — only re-sorts when sortOrder changes
 * or new sites appear (appended per sortOrder).
 */
export const applyStableSiteOrder = (
  sites: MonitoredWebsite[],
  sortOrder: WebsiteMonitorSortOrder,
): MonitoredWebsite[] => {
  if (sessionSortOrder !== sortOrder) {
    sessionSortOrder = sortOrder;
    sessionStableOrder = null;
  }

  if (!sites.length) {
    sessionStableOrder = [];
    return [];
  }

  if (!sessionStableOrder?.length) {
    const sorted = sortMonitoredWebsites(sites, sortOrder);
    sessionStableOrder = sorted.map((site) => site.id);
    return sorted;
  }

  const byId = new Map(sites.map((site) => [String(site.id), site]));
  const ordered: MonitoredWebsite[] = [];

  for (const id of sessionStableOrder) {
    const site = byId.get(String(id));
    if (site) ordered.push(site);
  }

  const known = new Set(sessionStableOrder.map(String));
  const added = sites.filter((site) => !known.has(String(site.id)));
  if (added.length > 0) {
    ordered.push(...sortMonitoredWebsites(added, sortOrder));
  }

  sessionStableOrder = ordered.map((site) => site.id);
  return ordered;
};

/** Call after manual sync or when user wants a fresh sort. */
export const resetStableSiteOrder = () => {
  sessionStableOrder = null;
};

/** Preserve client sort order in ra-core useList via stable _listOrder index. */
export const withListOrder = (sites: MonitoredWebsite[]) =>
  sites.map((site, index) => ({ ...site, _listOrder: index }));

export type MonitoredWebsiteListRow = MonitoredWebsite & { _listOrder: number };
