import { useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  useDataProvider,
  useGetList,
  useRefresh,
  type Identifier,
} from "ra-core";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import { WebsiteMonitorFavicon } from "@/lbs/website-monitor/WebsiteMonitorFavicon";
import { WebsiteStatusBadge } from "@/lbs/website-monitor/WebsiteStatusBadge";
import {
  formatCheckedAt,
  formatResponseMs,
} from "@/lbs/website-monitor/websiteMonitorUtils";
import { getWebMonitorShowPath } from "@/lbs/routing";

const STALE_MS = 5 * 60 * 1000;

export const WebsiteMonitorStatusWidget = ({
  companyId,
  dealId,
  title = "Estado web",
}: {
  companyId?: Identifier | null;
  dealId?: Identifier | null;
  title?: string;
}) => {
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const checkedRef = useRef(false);

  const filter: Record<string, unknown> = { is_enabled: true };
  if (companyId != null) filter["company_id@eq"] = companyId;
  if (dealId != null) filter["deal_id@eq"] = dealId;

  const enabled = companyId != null || dealId != null;

  const { data: sites = [], isPending } = useGetList<MonitoredWebsite>(
    "monitored_websites",
    {
      filter,
      pagination: { page: 1, perPage: 10 },
      sort: { field: "last_checked_at", order: "DESC" },
    },
    { enabled },
  );

  useEffect(() => {
    if (!enabled || checkedRef.current || !sites.length) return;
    const staleSite = sites.find((site) => {
      if (!site.last_checked_at) return true;
      return Date.now() - new Date(site.last_checked_at).getTime() > STALE_MS;
    });
    if (!staleSite?.id) return;

    checkedRef.current = true;
    void dataProvider
      .websiteMonitorCheck({ monitoredWebsiteId: staleSite.id })
      .then(() => refresh())
      .catch(() => undefined);
  }, [dataProvider, enabled, refresh, sites]);

  if (!enabled) return null;

  if (isPending) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" />
        Analizando sitio…
      </div>
    );
  }

  if (!sites.length) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Sin sitios monitoreados vinculados.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="space-y-2">
        {sites.map((site) => (
          <SiteRow key={site.id} site={site} onRefresh={() => refresh()} />
        ))}
      </div>
    </div>
  );
};

const SiteRow = ({
  site,
  onRefresh,
}: {
  site: MonitoredWebsite;
  onRefresh: () => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const handleRefresh = async () => {
    await dataProvider.websiteMonitorCheck({ monitoredWebsiteId: site.id });
    onRefresh();
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
      <WebsiteMonitorFavicon url={site.url} label={site.display_name ?? site.url} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          to={getWebMonitorShowPath(site.id)}
          className="block truncate text-sm font-medium hover:underline"
        >
          {site.display_name || site.company_name || site.url}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {formatResponseMs(site.last_response_ms)} · {formatCheckedAt(site.last_checked_at)}
        </p>
      </div>
      <WebsiteStatusBadge status={site.last_status} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => void handleRefresh()}
        aria-label="Actualizar"
      >
        <RefreshCw className="size-4" />
      </Button>
    </div>
  );
};
