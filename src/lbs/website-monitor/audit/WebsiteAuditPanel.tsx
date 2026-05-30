import { Link } from "react-router-dom";
import { useDataProvider, useNotify, type Identifier } from "ra-core";
import { ExternalLink, FileSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useWebsiteAudit } from "@/lbs/website-monitor/audit/useWebsiteAudit";
import { WebsiteAuditReportView } from "@/lbs/website-monitor/audit/WebsiteAuditReportView";
import { deltaVsPreviousDone } from "@/lbs/website-monitor/audit/websiteAuditQueries";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  running: "Analizando…",
  done: "Completado",
  failed: "Fallido",
};

const formatDelta = (delta: number | null) => {
  if (delta == null) return "—";
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const strategyHistoryLabel = (strategy: string) => {
  if (strategy === "unified") return " · completo";
  if (strategy === "desktop") return " · desktop";
  return " · móvil";
};

export const WebsiteAuditPanel = ({ siteId }: { siteId: Identifier }) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const {
    audit,
    history,
    findings,
    previousAudit,
    isActive,
    isPending,
    historyPending,
    refetch,
  } = useWebsiteAudit(siteId);

  const handleGenerate = async () => {
    setIsEnqueueing(true);
    try {
      const result = await dataProvider.websiteAuditEnqueue({
        monitoredWebsiteId: siteId,
      });
      if (result.audit.status === "failed") {
        notify(result.audit.error_message ?? "No se pudo iniciar el reporte", {
          type: "warning",
        });
      } else if (result.reused) {
        notify("Ya hay un reporte en curso para este sitio", { type: "info" });
      } else {
        notify("Reporte web encolado (móvil + desktop)", { type: "info" });
      }
      void refetch();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "No se pudo generar el reporte",
        { type: "error" },
      );
    } finally {
      setIsEnqueueing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Web Report</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isEnqueueing || isActive}
          onClick={() => void handleGenerate()}
        >
          {isEnqueueing || isActive ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <FileSearch className="mr-2 size-4" />
          )}
          Generar reporte
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isPending && !audit ? (
          <p className="text-sm text-muted-foreground">Cargando reportes…</p>
        ) : !audit ? (
          <p className="text-sm text-muted-foreground">
            Genera un reporte completo (móvil + desktop) con scores Lighthouse,
            axe y hallazgos priorizados. Abre el portal para descargar PDF.
          </p>
        ) : (
          <>
            <WebsiteAuditReportView
              audit={audit}
              previousAudit={previousAudit ?? undefined}
              findings={findings}
              showPdfActions={false}
            />
            {audit.status === "done" ? (
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link to={`/web-monitor/${siteId}/audit/${audit.id}`}>
                  <ExternalLink className="mr-2 size-4" />
                  Abrir portal del reporte
                </Link>
              </Button>
            ) : null}
          </>
        )}

        {historyPending ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : history.length > 0 ? (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-sm font-medium">Historial de reportes</p>
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {history.map((row, index) => {
                const delta = deltaVsPreviousDone(history, index);
                return (
                  <li key={row.id}>
                    <Link
                      to={`/web-monitor/${siteId}/audit/${row.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="text-muted-foreground">
                        {formatCheckedAt(row.requested_at)}
                        {strategyHistoryLabel(row.strategy)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.status === "done" && row.overall_score != null ? (
                          <span className="font-medium tabular-nums">
                            {row.overall_score}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({formatDelta(delta)})
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <Badge
                          variant={
                            row.status === "failed" ? "destructive" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
