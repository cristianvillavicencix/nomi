import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import { WebsiteMonitorFavicon } from "@/lbs/website-monitor/WebsiteMonitorFavicon";
import { WebsiteStatusBadge } from "@/lbs/website-monitor/WebsiteStatusBadge";
import {
  extractDomainFromUrl,
  formatCheckedAt,
  formatResponseMs,
  formatUptimePct,
  isSslExpiringSoon,
} from "@/lbs/website-monitor/websiteMonitorUtils";
import { getClientShowPath } from "@/lbs/routing";

export const WebsiteMonitorSummaryCard = ({
  site,
}: {
  site: MonitoredWebsite;
}) => {
  const { companySectors } = useConfigurationContext();
  const title =
    site.display_name || site.company_name || site.page_title || site.url;
  const domain = site.resolved_domain ?? extractDomainFromUrl(site.url);
  const sectorLabel = site.company_sector
    ? companySectors.find((entry) => entry.value === site.company_sector)
        ?.label ?? site.company_sector
    : null;
  const registrar = site.metadata?.dns?.registrar;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-4 py-4">
        <div className="flex flex-col items-center text-center">
          <WebsiteMonitorFavicon url={site.url} label={title} size="lg" />
          <h1 className="mt-3 line-clamp-2 text-lg font-semibold">{title}</h1>
          <a
            href={site.url}
            target="_blank"
            rel="noreferrer"
            className="link-action mt-2 inline-flex max-w-full items-center gap-1 truncate text-sm"
          >
            {site.url}
            <ExternalLink className="size-3 shrink-0" />
          </a>
          <div className="mt-3">
            <WebsiteStatusBadge status={site.last_status} />
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-sm">
          <InfoRow label="Dominio" value={domain ?? "—"} />
          <InfoRow label="Hosting" value={site.hosting_provider ?? "—"} />
          <InfoRow
            label="Stack"
            value={site.tech_stack?.length ? site.tech_stack.join(", ") : "—"}
          />
          <InfoRow label="Registrador" value={registrar ?? "—"} />
          <InfoRow label="DNS IP" value={site.dns_ip ?? "—"} />
          <InfoRow
            label="SSL"
            value={
              site.ssl_days_remaining != null
                ? `${site.ssl_days_remaining} días${
                    isSslExpiringSoon(site.ssl_days_remaining) ? " ⚠" : ""
                  }`
                : "—"
            }
          />
          <InfoRow label="Respuesta" value={formatResponseMs(site.last_response_ms)} />
          <InfoRow label="Uptime 7d" value={formatUptimePct(site.uptime_pct_7d)} />
          <InfoRow label="Último chequeo" value={formatCheckedAt(site.last_checked_at)} />
          {sectorLabel ? <InfoRow label="Sector" value={sectorLabel} /> : null}
          {site.company_id ? (
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 pt-1">
              <span className="text-muted-foreground">Cliente</span>
              <Link
                to={getClientShowPath(site.company_id)}
                className="font-medium hover:underline"
              >
                {site.company_name ?? "Ver cliente"}
              </Link>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words font-medium">{value}</span>
  </div>
);
