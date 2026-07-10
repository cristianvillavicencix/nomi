import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { AlertTriangle, Globe, Link2, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  computeHostingerOverviewStats,
} from "@/modules/hostinger/hostingerDomainUtils";
import { getHostingerDomainsUrl, getHostingerHpanelHomeUrl } from "@/modules/hostinger/hostingerHpanelLinks";
import type { HostingerDomain } from "@/modules/hostinger/types";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

const DOMAINS_QUERY_KEY = ["hostinger_domains", "overview"] as const;

const StatCard = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) => {
  const toneClass =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "";

  return (
    <Card className={toneClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export const HostingerOverviewTab = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const settingsQuery = useQuery({
    queryKey: ["hostinger_settings"],
    queryFn: () => dataProvider.getHostingerSettings(),
  });

  const domainsQuery = useQuery({
    queryKey: DOMAINS_QUERY_KEY,
    queryFn: async () => {
      const response = await dataProvider.getList<HostingerDomain>(
        "hostinger_domains",
        {
          pagination: { page: 1, perPage: 500 },
          sort: { field: "expires_at", order: "ASC" },
          filter: {},
        },
      );
      return response.data;
    },
    enabled: settingsQuery.data?.has_api_token === true,
  });

  const stats = useMemo(
    () => computeHostingerOverviewStats(domainsQuery.data ?? []),
    [domainsQuery.data],
  );

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading overview…</p>;
  }

  if (!settingsQuery.data?.has_api_token) {
    return (
      <Alert>
        <AlertDescription>
          Connect your Hostinger API token in{" "}
          <Link
            to={`/settings?${buildSettingsSearchParams("connectors", "hostinger").toString()}`}
            className="font-medium underline"
          >
            Settings → Integrations → Hostinger
          </Link>{" "}
          to sync your domain portfolio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {settingsQuery.data.last_sync_error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Last sync failed: {settingsQuery.data.last_sync_error}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={getHostingerHpanelHomeUrl()} target="_blank" rel="noreferrer">
            <Globe className="mr-1.5 size-4" />
            Open hPanel
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={getHostingerDomainsUrl()} target="_blank" rel="noreferrer">
            <Link2 className="mr-1.5 size-4" />
            Domains in hPanel
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link
            to={`/settings?${buildSettingsSearchParams("connectors", "hostinger").toString()}`}
          >
            Integration settings
          </Link>
        </Button>
        {settingsQuery.data.last_synced_at ? (
          <span className="text-xs text-muted-foreground">
            Last synced{" "}
            {new Date(settingsQuery.data.last_synced_at).toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Portfolio not synced yet — run Sync in integration settings.
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total domains" value={stats.total} />
        <StatCard
          label="Expiring in 30 days"
          value={stats.expiring30}
          tone={stats.expiring30 > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Expired"
          value={stats.expired}
          tone={stats.expired > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Unlinked to clients"
          value={stats.unlinked}
          hint="No matching company website"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Expiring in 60 days" value={stats.expiring60} />
        <StatCard label="Expiring in 90 days" value={stats.expiring90} />
      </div>

      {domainsQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Loading domains…
        </p>
      ) : null}
    </div>
  );
};
