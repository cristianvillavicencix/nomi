import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Loader2, Pin, PinOff, RefreshCw, Search } from "lucide-react";

import {
  PageLayout,
  ScrollableContentArea,
  StickyPageHeader,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { WebsiteMonitorCheckResult } from "@/components/atomic-crm/providers/supabase/modules/webMonitorProvider";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { WebsiteStatusBadge } from "./WebsiteStatusBadge";
import { WebsiteMonitorFavicon } from "./WebsiteMonitorFavicon";
import { formatCheckedAt, formatResponseMs } from "./websiteMonitorUtils";
import type { MonitoredWebsite, WebsiteMonitorStatus } from "./types";

type CheckResultState = WebsiteMonitorCheckResult & { url: string };

const PINNED_QUERY_KEY = ["monitored_websites", "pinned"] as const;

export const WebsiteMonitorQuickCheckPage = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [urlInput, setUrlInput] = useState("");
  const [result, setResult] = useState<CheckResultState | null>(null);

  const pinnedQuery = useQuery({
    queryKey: PINNED_QUERY_KEY,
    queryFn: async () => {
      const response = await dataProvider.getList<MonitoredWebsite>(
        "monitored_websites",
        {
          pagination: { page: 1, perPage: 100 },
          sort: { field: "updated_at", order: "DESC" },
          filter: {},
        },
      );
      return response.data;
    },
  });

  const adHocCheck = useMutation({
    mutationFn: async (rawUrl: string) => {
      return dataProvider.websiteMonitorCheckAdHoc({ url: rawUrl });
    },
    onSuccess: (data, rawUrl) => {
      setResult({ ...data, url: data.url ?? rawUrl });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Check failed", {
        type: "error",
      });
    },
  });

  const pinSite = useMutation({
    mutationFn: async (url: string) => {
      return dataProvider.websiteMonitorCreate({
        url,
        checkPaths: ["/"],
      });
    },
    onSuccess: () => {
      notify("Site pinned", { type: "info" });
      queryClient.invalidateQueries({ queryKey: PINNED_QUERY_KEY });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Failed to pin site", {
        type: "error",
      });
    },
  });

  const recheckPinned = useMutation({
    mutationFn: async (siteId: MonitoredWebsite["id"]) => {
      return dataProvider.websiteMonitorCheck({
        monitoredWebsiteId: siteId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PINNED_QUERY_KEY });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Re-check failed", {
        type: "error",
      });
    },
  });

  const unpinSite = useMutation({
    mutationFn: async (siteId: MonitoredWebsite["id"]) => {
      await dataProvider.delete("monitored_websites", {
        id: siteId,
        previousData: { id: siteId } as never,
      });
    },
    onSuccess: () => {
      notify("Site unpinned", { type: "info" });
      queryClient.invalidateQueries({ queryKey: PINNED_QUERY_KEY });
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Failed to unpin site", {
        type: "error",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    adHocCheck.mutate(trimmed);
  };

  return (
    <PageLayout>
      <StickyPageHeader className="pb-2">
        <div className="flex items-center justify-end">
          <ModuleInfoPopover
            title="Web Monitor"
            description="Check any URL on demand for status, response time, SSL, DNS, hosting and tech stack. Pin sites you want to keep around for quick re-checks. No automatic polling."
          />
        </div>
      </StickyPageHeader>
      <ScrollableContentArea>
        <div className="flex flex-col gap-6 px-4 pb-6 md:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick check</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 md:flex-row"
              >
                <Input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="https://example.com"
                  autoFocus
                  className="md:flex-1"
                  type="url"
                />
                <Button
                  type="submit"
                  disabled={adHocCheck.isPending || !urlInput.trim()}
                  className="md:w-44"
                >
                  {adHocCheck.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Run check
                </Button>
              </form>
            </CardContent>
          </Card>

          {result ? (
            <CheckResultCard
              result={result}
              onPin={() => pinSite.mutate(result.url)}
              pinDisabled={pinSite.isPending}
            />
          ) : null}

          <Separator />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Pinned sites</CardTitle>
              <span className="text-muted-foreground text-xs">
                {pinnedQuery.data?.length ?? 0} saved
              </span>
            </CardHeader>
            <CardContent>
              {pinnedQuery.isLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : pinnedQuery.data && pinnedQuery.data.length > 0 ? (
                <ul className="divide-border divide-y">
                  {pinnedQuery.data.map((site) => (
                    <PinnedSiteRow
                      key={site.id}
                      site={site}
                      onRecheck={() => recheckPinned.mutate(site.id)}
                      recheckLoading={
                        recheckPinned.isPending &&
                        recheckPinned.variables === site.id
                      }
                      onUnpin={() => unpinSite.mutate(site.id)}
                      unpinLoading={
                        unpinSite.isPending && unpinSite.variables === site.id
                      }
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Run a check above and pin a site to keep it here for quick
                  re-checks.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollableContentArea>
    </PageLayout>
  );
};

const CheckResultCard = ({
  result,
  onPin,
  pinDisabled,
}: {
  result: CheckResultState;
  onPin: () => void;
  pinDisabled: boolean;
}) => {
  const status = (result.status ?? "unknown") as WebsiteMonitorStatus;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <WebsiteMonitorFavicon url={result.url} size="sm" />
            <CardTitle className="truncate text-base">{result.url}</CardTitle>
          </div>
          {result.pageTitle ? (
            <p className="text-muted-foreground truncate text-xs">
              {result.pageTitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <WebsiteStatusBadge status={status} />
          <Button
            size="sm"
            variant="secondary"
            onClick={onPin}
            disabled={pinDisabled}
          >
            <Pin className="size-4" />
            Pin this site
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-4">
          <ResultField label="Response">
            {formatResponseMs(result.responseMs)}
          </ResultField>
          <ResultField label="HTTP">{result.httpStatus ?? "—"}</ResultField>
          <ResultField label="SSL expires">
            {result.sslDaysRemaining != null
              ? `${result.sslDaysRemaining} days`
              : "—"}
          </ResultField>
          <ResultField label="Hosting">
            {result.hostingProvider ?? "—"}
          </ResultField>
          <ResultField label="DNS IP">{result.dnsIp ?? "—"}</ResultField>
          <ResultField label="Nameservers">
            {result.dnsNameservers && result.dnsNameservers.length > 0
              ? result.dnsNameservers.join(", ")
              : "—"}
          </ResultField>
          <ResultField label="MX">
            {result.dnsMx && result.dnsMx.length > 0
              ? result.dnsMx.join(", ")
              : "—"}
          </ResultField>
          <ResultField label="Tech stack" wide>
            {result.techStack && result.techStack.length > 0
              ? result.techStack.join(", ")
              : "—"}
          </ResultField>
        </dl>
        {result.errorMessage ? (
          <p className="text-destructive mt-3 text-sm">{result.errorMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

const ResultField = ({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <div className={wide ? "col-span-2 sm:col-span-3 md:col-span-4" : undefined}>
    <dt className="text-muted-foreground text-[11px] uppercase tracking-wide">
      {label}
    </dt>
    <dd className="font-mono text-sm">{children}</dd>
  </div>
);

const PinnedSiteRow = ({
  site,
  onRecheck,
  recheckLoading,
  onUnpin,
  unpinLoading,
}: {
  site: MonitoredWebsite;
  onRecheck: () => void;
  recheckLoading: boolean;
  onUnpin: () => void;
  unpinLoading: boolean;
}) => {
  const status = (site.last_status ?? "unknown") as WebsiteMonitorStatus;
  return (
    <li className="flex items-center gap-3 py-3">
      <WebsiteMonitorFavicon url={site.url} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {site.display_name || site.url}
          </span>
          <WebsiteStatusBadge status={status} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span className="truncate">{site.url}</span>
          <span>·</span>
          <span>{formatResponseMs(site.last_response_ms)}</span>
          <span>·</span>
          <span>Last check: {formatCheckedAt(site.last_checked_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onRecheck}
          disabled={recheckLoading}
        >
          {recheckLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Re-check
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onUnpin}
          disabled={unpinLoading}
        >
          {unpinLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PinOff className="size-4" />
          )}
        </Button>
      </div>
    </li>
  );
};
