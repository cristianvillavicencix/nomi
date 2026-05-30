import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useList,
  useNotify,
  ListContextProvider,
  ResourceContextProvider,
  type Identifier,
} from "ra-core";
import { Globe, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ListPagination } from "@/components/admin/list-pagination";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import {
  WebsiteStatusBadge,
  WebsiteStatusDot,
} from "@/lbs/website-monitor/WebsiteStatusBadge";
import { AddWebsiteMonitorDialog } from "@/lbs/website-monitor/AddWebsiteMonitorDialog";
import { WebsiteMonitorFavicon } from "@/lbs/website-monitor/WebsiteMonitorFavicon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCheckedAt,
  formatResponseMs,
  isMarketingOpportunity,
  uniqueSorted,
} from "@/lbs/website-monitor/websiteMonitorUtils";
import { getClientShowPath } from "@/lbs/routing";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";
import { useMonitoredWebsitesLive } from "@/lbs/website-monitor/useMonitoredWebsitesLive";
import { patchMonitoredWebsiteInCache } from "@/lbs/website-monitor/websiteMonitorRealtimeCache";
import type { WebsiteMonitorStatus } from "@/lbs/website-monitor/types";

type StatusFilter = "all" | "up" | "slow" | "down" | "unknown" | "opportunities";

export const WebsiteMonitorListPage = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hostingFilter, setHostingFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [checkingIds, setCheckingIds] = useState<Set<Identifier>>(() => new Set());
  const bootstrapStarted = useRef(false);
  const pendingChecksStarted = useRef(false);
  const { enabled: moduleEnabled, isPending: settingsPending } =
    useWebsiteMonitorEnabled();

  const {
    sites,
    total,
    isInitialLoading,
    refetch: refetchSites,
  } = useMonitoredWebsitesLive(moduleEnabled);

  useEffect(() => {
    if (!moduleEnabled || bootstrapStarted.current) return;
    bootstrapStarted.current = true;

    void (async () => {
      try {
        await dataProvider.websiteMonitorSync();
        void refetchSites();
      } catch {
        // Sync is best-effort on load; cron and company triggers keep data fresh.
      }
    })();
  }, [dataProvider, moduleEnabled, refetchSites]);

  useEffect(() => {
    if (!moduleEnabled || isInitialLoading || pendingChecksStarted.current) return;

    const needsCheck = sites.some(
      (site) =>
        site.is_enabled &&
        (!site.last_checked_at || !site.hosting_provider),
    );
    if (!needsCheck) return;

    pendingChecksStarted.current = true;
    void (async () => {
      try {
        await dataProvider.websiteMonitorRunOrg({ forceAll: false });
        void refetchSites();
      } catch {
        // Background batch; user can refresh individual rows manually.
      }
    })();
  }, [dataProvider, isInitialLoading, moduleEnabled, refetchSites, sites]);

  const filterOptions = useMemo(() => {
    return {
      hosting: uniqueSorted(sites.map((site) => site.hosting_provider)),
      tech: uniqueSorted(sites.flatMap((site) => site.tech_stack ?? [])),
      sectors: uniqueSorted(sites.map((site) => site.company_sector)),
    };
  }, [sites]);

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sites.filter((site) => {
      if (hostingFilter !== "all" && site.hosting_provider !== hostingFilter) {
        return false;
      }
      if (techFilter !== "all" && !(site.tech_stack ?? []).includes(techFilter)) {
        return false;
      }
      if (sectorFilter !== "all" && site.company_sector !== sectorFilter) {
        return false;
      }
      if (statusFilter === "opportunities" && !isMarketingOpportunity(site.last_status)) {
        return false;
      }
      if (
        statusFilter !== "all" &&
        statusFilter !== "opportunities" &&
        site.last_status !== statusFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        site.display_name,
        site.company_name,
        site.url,
        site.hosting_provider,
        ...(site.tech_stack ?? []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [hostingFilter, search, sectorFilter, sites, statusFilter, techFilter]);

  const statusCounts = useMemo(
    () => ({
      all: sites.length,
      up: sites.filter((site) => site.last_status === "up").length,
      slow: sites.filter((site) => site.last_status === "slow").length,
      down: sites.filter((site) => site.last_status === "down").length,
      opportunities: sites.filter((site) =>
        isMarketingOpportunity(site.last_status),
      ).length,
    }),
    [sites],
  );

  const activeFilterCount = [
    hostingFilter !== "all",
    techFilter !== "all",
    sectorFilter !== "all",
  ].filter(Boolean).length;

  const handleCheckSite = async (siteId: Identifier) => {
    setCheckingIds((current) => new Set(current).add(siteId));
    try {
      const result = await dataProvider.websiteMonitorCheck({
        monitoredWebsiteId: siteId,
      });
      patchMonitoredWebsiteInCache(queryClient, {
        id: siteId,
        last_status: result.status as WebsiteMonitorStatus | undefined,
        last_response_ms: result.responseMs ?? null,
        last_http_status: result.httpStatus ?? null,
        last_checked_at: new Date().toISOString(),
        last_error: result.errorMessage ?? null,
      });
      notify("Sitio actualizado", { type: "info" });
    } catch {
      notify("No se pudo actualizar el sitio", { type: "error" });
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(siteId);
        return next;
      });
    }
  };

  return (
    <PageLayout>
      <PageActions>
        <PageTitle label="Web Monitor" count={total ?? sites.length} />
        <AddWebsiteMonitorDialog />
        <ModuleInfoPopover
          title="Web Monitor"
          description="Todas las empresas con sitio web se sincronizan solas. Los chequeos corren cada 5 minutos; usa el ícono de refresh en cada fila para actualizar al instante."
        />
      </PageActions>

      <ScrollableContentArea>
        <div className="space-y-4 p-4 md:p-6">
          {!settingsPending && !moduleEnabled ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Globe className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Web Monitor está pausado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Actívalo en Settings para reanudar chequeos y alertas.
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/settings?tab=web-monitor">Ir a Settings</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="all">Todos ({statusCounts.all})</TabsTrigger>
                <TabsTrigger value="up">Up ({statusCounts.up})</TabsTrigger>
                <TabsTrigger value="slow">Slow ({statusCounts.slow})</TabsTrigger>
                <TabsTrigger value="down">Down ({statusCounts.down})</TabsTrigger>
                <TabsTrigger value="opportunities">
                  Outreach ({statusCounts.opportunities})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-[180px] flex-1 basis-[200px] sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar empresa o URL"
                className="pl-9"
              />
            </div>
            <WebsiteMonitorFiltersPopover
              hostingFilter={hostingFilter}
              techFilter={techFilter}
              sectorFilter={sectorFilter}
              filterOptions={filterOptions}
              activeFilterCount={activeFilterCount}
              onHostingChange={setHostingFilter}
              onTechChange={setTechFilter}
              onSectorChange={setSectorFilter}
              onClear={() => {
                setHostingFilter("all");
                setTechFilter("all");
                setSectorFilter("all");
              }}
            />
          </div>

          {isInitialLoading ? (
            <p className="text-sm text-muted-foreground">Cargando sitios…</p>
          ) : !filteredSites.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Globe className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Aún no hay sitios para monitorear</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agrega un sitio web al guardar una empresa o cliente y aparecerá
                  aquí automáticamente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <PaginatedWebsiteTable
              filterKey={`${statusFilter}-${hostingFilter}-${techFilter}-${sectorFilter}-${search}`}
              sites={filteredSites}
              checkingIds={checkingIds}
              onCheckSite={handleCheckSite}
              onOpenSite={(siteId) => navigate(`/web-monitor/${siteId}/show`)}
            />
          )}
            </>
          )}
        </div>
      </ScrollableContentArea>
    </PageLayout>
  );
};

const WebsiteMonitorFiltersPopover = ({
  hostingFilter,
  techFilter,
  sectorFilter,
  filterOptions,
  activeFilterCount,
  onHostingChange,
  onTechChange,
  onSectorChange,
  onClear,
}: {
  hostingFilter: string;
  techFilter: string;
  sectorFilter: string;
  filterOptions: {
    hosting: string[];
    tech: string[];
    sectors: string[];
  };
  activeFilterCount: number;
  onHostingChange: (value: string) => void;
  onTechChange: (value: string) => void;
  onSectorChange: (value: string) => void;
  onClear: () => void;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative shrink-0"
        aria-label="Filtros"
        title="Filtros"
      >
        <SlidersHorizontal className="size-4" />
        {activeFilterCount > 0 ? (
          <Badge className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
            {activeFilterCount}
          </Badge>
        ) : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Filtros</p>
        {activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClear}
          >
            Limpiar
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="wm-filter-hosting">Hosting</Label>
        <Select value={hostingFilter} onValueChange={onHostingChange}>
          <SelectTrigger id="wm-filter-hosting" className="w-full">
            <SelectValue placeholder="Hosting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo hosting</SelectItem>
            {filterOptions.hosting.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wm-filter-tech">Stack</Label>
        <Select value={techFilter} onValueChange={onTechChange}>
          <SelectTrigger id="wm-filter-tech" className="w-full">
            <SelectValue placeholder="Stack" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo stack</SelectItem>
            {filterOptions.tech.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wm-filter-sector">Sector</Label>
        <Select value={sectorFilter} onValueChange={onSectorChange}>
          <SelectTrigger id="wm-filter-sector" className="w-full">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo sector</SelectItem>
            {filterOptions.sectors.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </PopoverContent>
  </Popover>
);

const PaginatedWebsiteTable = ({
  filterKey,
  sites,
  checkingIds,
  onCheckSite,
  onOpenSite,
}: {
  filterKey: string;
  sites: MonitoredWebsite[];
  checkingIds: Set<Identifier>;
  onCheckSite: (siteId: Identifier) => Promise<void>;
  onOpenSite: (siteId: Identifier) => void;
}) => {
  const listContext = useList({
    data: sites,
    total: sites.length,
    resource: "monitored_websites",
    perPage: 25,
    sort: { field: "last_checked_at", order: "DESC" },
  });
  const records = listContext.data ?? [];

  useEffect(() => {
    listContext.setPage(1);
  }, [filterKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sites.length / listContext.perPage));
    if (listContext.page > maxPage) {
      listContext.setPage(maxPage);
    }
  }, [listContext.page, listContext.perPage, listContext.setPage, sites.length]);

  return (
    <ResourceContextProvider value="monitored_websites">
      <ListContextProvider value={listContext}>
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Empresa / sitio</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12 text-center">Acciones</TableHead>
                  <TableHead>Respuesta</TableHead>
                  <TableHead>Stack</TableHead>
                  <TableHead>Hosting</TableHead>
                  <TableHead>Último chequeo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const isChecking = checkingIds.has(record.id);

                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      onClick={() => onOpenSite(record.id)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <WebsiteMonitorFavicon
                          url={record.url}
                          label={
                            record.display_name || record.company_name || record.url
                          }
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 flex items-center gap-2">
                          <WebsiteStatusDot status={record.last_status} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {record.display_name || record.company_name || "—"}
                            </p>
                            {record.company_id ? (
                              <Link
                                to={getClientShowPath(record.company_id)}
                                className="text-xs text-muted-foreground hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Ver cliente
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                URL manual
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <a
                          href={record.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {record.url}
                        </a>
                      </TableCell>
                      <TableCell>
                        <WebsiteStatusBadge status={record.last_status} />
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={isChecking}
                          aria-label="Actualizar estado del sitio"
                          title="Actualizar ahora"
                          onClick={() => void onCheckSite(record.id)}
                        >
                          {isChecking ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatResponseMs(record.last_response_ms)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm">
                        {record.tech_stack?.length
                          ? record.tech_stack.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>{record.hosting_provider ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatCheckedAt(record.last_checked_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {sites.length > 0 ? (
            <ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />
          ) : null}
        </div>
      </ListContextProvider>
    </ResourceContextProvider>
  );
};
