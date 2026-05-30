import type { QueryClient } from "@tanstack/react-query";
import type { Identifier } from "ra-core";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";

export type MonitoredWebsitesListCache = {
  data: MonitoredWebsite[];
  total: number;
};

export const MONITORED_WEBSITES_LIVE_KEY = ["monitored_websites", "live"] as const;

export const getMonitoredWebsitesLiveParams = () => ({
  pagination: { page: 1, perPage: 500 },
  sort: { field: "last_checked_at", order: "DESC" as const },
  filter: { "is_enabled@eq": true },
});

export const getMonitoredWebsitesLiveQueryKey = () =>
  [...MONITORED_WEBSITES_LIVE_KEY, getMonitoredWebsitesLiveParams()] as const;

const sortByLastChecked = (sites: MonitoredWebsite[]) =>
  sites.slice().sort((a, b) => {
    const aTime = a.last_checked_at
      ? new Date(a.last_checked_at).getTime()
      : 0;
    const bTime = b.last_checked_at
      ? new Date(b.last_checked_at).getTime()
      : 0;
    return bTime - aTime;
  });

export const patchMonitoredWebsiteInCache = (
  queryClient: QueryClient,
  patch: Partial<MonitoredWebsite> & { id: Identifier },
) => {
  queryClient.setQueryData<MonitoredWebsitesListCache>(
    getMonitoredWebsitesLiveQueryKey(),
    (old) => {
      if (!old) return old;

      const id = String(patch.id);
      const index = old.data.findIndex((site) => String(site.id) === id);

      if (patch.is_enabled === false) {
        const data = old.data.filter((site) => String(site.id) !== id);
        return { data, total: data.length };
      }

      if (index < 0) {
        return old;
      }

      const data = [...old.data];
      data[index] = { ...data[index], ...patch };
      return { data: sortByLastChecked(data), total: data.length };
    },
  );
};

export const scheduleMonitoredWebsitesSilentRefetch = (
  queryClient: QueryClient,
  timers: Map<string, ReturnType<typeof setTimeout>>,
  bucket = "default",
  delayMs = 400,
) => {
  const existing = timers.get(bucket);
  if (existing) clearTimeout(existing);

  timers.set(
    bucket,
    setTimeout(() => {
      timers.delete(bucket);
      void queryClient.refetchQueries({
        queryKey: MONITORED_WEBSITES_LIVE_KEY,
        type: "active",
      });
    }, delayMs),
  );
};
