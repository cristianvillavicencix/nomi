import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  getMonitoredWebsitesLiveQueryKey,
  getMonitoredWebsitesLiveParams,
  type MonitoredWebsitesListCache,
} from "@/lbs/website-monitor/websiteMonitorRealtimeCache";
import { useWebsiteMonitorRealtime } from "@/lbs/website-monitor/useWebsiteMonitorRealtime";

/** Cache list for the session; metrics update via Realtime patches. */
const LIST_STALE_MS = 24 * 60 * 60_000;

export const useMonitoredWebsitesLive = (enabled = true) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const params = getMonitoredWebsitesLiveParams();
  const queryKey = getMonitoredWebsitesLiveQueryKey();

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MonitoredWebsitesListCache> => {
      const result = await dataProvider.getList("monitored_websites", params);
      return {
        data: (result.data ?? []) as MonitoredWebsitesListCache["data"],
        total: result.total ?? result.data?.length ?? 0,
      };
    },
    enabled,
    placeholderData: (previous) => previous,
    staleTime: LIST_STALE_MS,
    gcTime: LIST_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  useWebsiteMonitorRealtime(enabled);

  return {
    sites: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isInitialLoading: query.isPending && query.data == null,
    refetch: query.refetch,
  };
};
