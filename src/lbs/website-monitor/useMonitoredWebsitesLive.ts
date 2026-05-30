import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  getMonitoredWebsitesLiveQueryKey,
  getMonitoredWebsitesLiveParams,
  type MonitoredWebsitesListCache,
} from "@/lbs/website-monitor/websiteMonitorRealtimeCache";
import { useWebsiteMonitorRealtime } from "@/lbs/website-monitor/useWebsiteMonitorRealtime";

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
    staleTime: 30_000,
    refetchInterval: enabled ? 120_000 : false,
  });

  useWebsiteMonitorRealtime(enabled);

  return {
    sites: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isInitialLoading: query.isPending && query.data == null,
    refetch: query.refetch,
  };
};
