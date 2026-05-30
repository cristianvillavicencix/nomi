import { useParams } from "react-router";
import { useGetOne } from "ra-core";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import { WebsiteMonitorShowContent } from "@/lbs/website-monitor/WebsiteMonitorShowContent";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";

export const WebsiteMonitorShowPage = () => {
  const { id = "" } = useParams();

  const { data: site, isPending } = useGetOne<MonitoredWebsite>(
    "monitored_websites",
    { id },
    { enabled: Boolean(id) },
  );

  if (isPending || !site) {
    return (
      <PageLayout>
        <ScrollableContentArea>
          <div className="p-6 text-sm text-muted-foreground">Cargando sitio…</div>
        </ScrollableContentArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ScrollableContentArea>
        <WebsiteMonitorShowContent site={site} />
      </ScrollableContentArea>
    </PageLayout>
  );
};
