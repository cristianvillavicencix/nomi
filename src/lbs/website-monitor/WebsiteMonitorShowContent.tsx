import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import { ExternalLink, Loader2, Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ResponseTimeChart } from "@/lbs/website-monitor/ResponseTimeChart";
import type {
  MonitoredWebsite,
  WebsiteCheck,
  WebsiteMonitorChange,
} from "@/lbs/website-monitor/types";
import { WebsiteMonitorSummaryCard } from "@/lbs/website-monitor/WebsiteMonitorSummaryCard";
import { WebsiteMonitorAlertSettings } from "@/lbs/website-monitor/WebsiteMonitorAlertSettings";
import { WebsiteStatusBadge } from "@/lbs/website-monitor/WebsiteStatusBadge";
import {
  CHANGE_TYPE_LABELS,
  formatCheckedAt,
  formatResponseMs,
  isMarketingOpportunity,
} from "@/lbs/website-monitor/websiteMonitorUtils";
import { getClientShowPath, getWebMonitorPath } from "@/lbs/routing";

export const WebsiteMonitorShowContent = ({ site }: { site: MonitoredWebsite }) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const isMobile = useIsMobile();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isChecking, setIsChecking] = useState(false);

  const { data: checks = [], isPending: checksPending } = useGetList<WebsiteCheck>(
    "website_checks",
    {
      filter: { "monitored_website_id@eq": site.id },
      sort: { field: "checked_at", order: "DESC" },
      pagination: { page: 1, perPage: 100 },
    },
  );

  const { data: changes = [] } = useGetList<WebsiteMonitorChange>(
    "website_monitor_changes",
    {
      filter: { "monitored_website_id@eq": site.id },
      sort: { field: "detected_at", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  const pageChecks = site.metadata?.pages ?? [];

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      await dataProvider.websiteMonitorCheck({ monitoredWebsiteId: site.id });
      notify("Sitio actualizado", { type: "info" });
      refresh();
    } catch {
      notify("No se pudo actualizar el sitio", { type: "error" });
    } finally {
      setIsChecking(false);
    }
  };

  const layout = isMobile ? (
    <div className="space-y-4">
      <WebsiteMonitorSummaryCard site={site} />
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
          <TabsTrigger value="changes">Cambios</TabsTrigger>
          <TabsTrigger value="checks">Historial</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>
        <TabPanels
          site={site}
          checks={checks}
          checksPending={checksPending}
          changes={changes}
          pageChecks={pageChecks}
        />
      </Tabs>
    </div>
  ) : (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <WebsiteMonitorSummaryCard site={site} />
      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
          <TabsTrigger value="changes">Cambios ({changes.length})</TabsTrigger>
          <TabsTrigger value="checks">Historial</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>
        <TabPanels
          site={site}
          checks={checks}
          checksPending={checksPending}
          changes={changes}
          pageChecks={pageChecks}
        />
      </Tabs>
    </div>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(getWebMonitorPath())}
        >
          ← Volver
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCheckNow()}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Actualizar ahora
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={site.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 size-4" />
              Abrir sitio
            </a>
          </Button>
        </div>
      </div>
      {layout}
    </div>
  );
};

const TabPanels = ({
  site,
  checks,
  checksPending,
  changes,
  pageChecks,
}: {
  site: MonitoredWebsite;
  checks: WebsiteCheck[];
  checksPending: boolean;
  changes: WebsiteMonitorChange[];
  pageChecks: NonNullable<MonitoredWebsite["metadata"]>["pages"];
}) => (
  <>
    <TabsContent value="overview" className="space-y-4">
      <WebsiteMonitorAlertSettings site={site} />
      <Card>
        <CardHeader>
          <CardTitle>Tiempo de respuesta</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseTimeChart
            checks={checks}
            slowThresholdMs={site.slow_threshold_ms}
          />
        </CardContent>
      </Card>
      {site.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{site.notes}</CardContent>
        </Card>
      ) : null}
    </TabsContent>

    <TabsContent value="pages">
      <Card>
        <CardHeader>
          <CardTitle>Páginas analizadas</CardTitle>
        </CardHeader>
        <CardContent>
          {!pageChecks?.length ? (
            <p className="text-sm text-muted-foreground">
              Solo se analiza la home. Edita las rutas en configuración del sitio.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Ruta</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Respuesta</th>
                    <th className="py-2">HTTP</th>
                  </tr>
                </thead>
                <tbody>
                  {pageChecks.map((page) => (
                    <tr key={page.path} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {page.path}
                        </a>
                      </td>
                      <td className="py-2 pr-4">
                        <WebsiteStatusBadge status={page.status} />
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatResponseMs(page.responseMs)}
                      </td>
                      <td className="py-2 tabular-nums">{page.httpStatus ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {site.check_paths?.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Rutas configuradas: {site.check_paths.join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="changes">
      <Card>
        <CardHeader>
          <CardTitle>Cambios detectados</CardTitle>
        </CardHeader>
        <CardContent>
          {!changes.length ? (
            <p className="text-sm text-muted-foreground">Sin cambios registrados aún.</p>
          ) : (
            <div className="space-y-3">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {CHANGE_TYPE_LABELS[change.change_type] ?? change.change_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCheckedAt(change.detected_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {change.previous_value ?? "—"} → {change.new_value ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="checks">
      <Card>
        <CardHeader>
          <CardTitle>Historial de chequeos</CardTitle>
        </CardHeader>
        <CardContent>
          {checksPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !checks.length ? (
            <p className="text-sm text-muted-foreground">Sin chequeos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Respuesta</th>
                    <th className="py-2 pr-4">HTTP</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((check) => (
                    <tr key={check.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatCheckedAt(check.checked_at)}
                      </td>
                      <td className="py-2 pr-4">
                        <WebsiteStatusBadge status={check.status} />
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {formatResponseMs(check.response_ms)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {check.http_status ?? "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {check.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="outreach">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4" />
            Oportunidad comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isMarketingOpportunity(site.last_status) ? (
            <>
              <p>
                Este sitio está <strong>{site.last_status === "down" ? "caído" : "lento"}</strong>.
                Buen momento para ofrecer mantenimiento, hosting o rediseño.
              </p>
              {site.company_id ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={getClientShowPath(site.company_id)}>Ver cliente</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">
              El sitio está estable. No hay oportunidad activa de outreach.
            </p>
          )}
          {site.hosting_provider ? (
            <p>Hosting detectado: {site.hosting_provider}</p>
          ) : null}
          {site.tech_stack?.length ? (
            <p>Stack: {site.tech_stack.join(", ")}</p>
          ) : null}
        </CardContent>
      </Card>
    </TabsContent>
  </>
);
