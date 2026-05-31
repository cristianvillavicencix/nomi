import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useGetOne } from "ra-core";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import { WebsiteMonitorShowContent } from "@/lbs/website-monitor/WebsiteMonitorShowContent";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import {
  getMonitoredWebsitesLiveQueryKey,
  type MonitoredWebsitesListCache,
} from "@/lbs/website-monitor/websiteMonitorRealtimeCache";

const findSiteInListCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): MonitoredWebsite | undefined => {
  const cached = queryClient.getQueryData<MonitoredWebsitesListCache>(
    getMonitoredWebsitesLiveQueryKey(),
  );
  return cached?.data.find((site) => String(site.id) === id);
};

export const WebsiteMonitorShowPage = () => {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const cachedSite = id ? findSiteInListCache(queryClient, id) : undefined;

  const { data: site, isPending } = useGetOne<MonitoredWebsite>(
    "monitored_websites",
    { id },
    {
      enabled: Boolean(id),
      staleTime: 2 * 60_000,
      placeholderData: cachedSite,
    },
  );

  const displaySite = site ?? cachedSite;

  if (!displaySite && isPending) {
    return (
      <PageLayout>
        <ScrollableContentArea>
          <div className="p-6 text-sm text-muted-foreground">
            Cargando sitio…
          </div>
        </ScrollableContentArea>
      </PageLayout>
    );
  }

  if (!displaySite) {
    return (
      <PageLayout>
        <ScrollableContentArea>
          <div className="p-6 text-sm text-muted-foreground">
            No se encontró este sitio.
          </div>
        </ScrollableContentArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ScrollableContentArea>
        <WebsiteMonitorShowContent site={displaySite} />
      </ScrollableContentArea>
    </PageLayout>
  );
};
