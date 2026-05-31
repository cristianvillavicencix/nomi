import { useNavigate } from "react-router-dom";
import { useDataProvider, useNotify, type Identifier } from "ra-core";
import { ChevronRight, FileSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useWebsiteAudit } from "@/lbs/website-monitor/audit/useWebsiteAudit";
import { deltaVsPreviousDone } from "@/lbs/website-monitor/audit/websiteAuditQueries";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";
import { useEffect, useMemo, useState } from "react";
import { registerWebsiteAuditWatch } from "@/lbs/website-monitor/audit/websiteAuditWatchStorage";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  running: "Analizando…",
  done: "Completado",
  failed: "Fallido",
};

const formatDelta = (delta: number | null) => {
  if (delta == null) return null;
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const strategyLabel = (strategy: string) => {
  if (strategy === "unified") return "Móvil + desktop";
  if (strategy === "desktop") return "Desktop";
  return "Móvil";
};

export const WebsiteAuditPanel = ({
  siteId,
  siteLabel,
}: {
  siteId: Identifier;
  siteLabel: string;
}) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const { history, isPending, historyPending, isActive, refetch } =
    useWebsiteAudit(siteId);

  const activeAudit = useMemo(
    () =>
      history.find(
        (row) => row.status === "queued" || row.status === "running",
      ) ?? null,
    [history],
  );

  useEffect(() => {
    if (!activeAudit) return;
    registerWebsiteAuditWatch({
      auditId: activeAudit.id,
      siteId: Number(siteId),
      siteLabel,
      requestedAt: activeAudit.requested_at,
    });
  }, [activeAudit, siteId, siteLabel]);

  const openReport = (auditId: number) => {
    navigate(`/web-monitor/${siteId}/audit/${auditId}`);
  };

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
      } else if (
        !result.reused &&
        result.worker &&
        "pushed" in result.worker &&
        result.worker.pushed === false
      ) {
        notify(
          "Reporte en cola; se reintentará la conexión con el worker automáticamente",
          { type: "warning" },
        );
        openReport(result.audit.id);
      } else if (result.reused) {
        notify("Ya hay un reporte en curso para este sitio", { type: "info" });
        openReport(result.audit.id);
      } else {
        notify("Reporte web encolado (móvil + desktop)", { type: "info" });
        registerWebsiteAuditWatch({
          auditId: result.audit.id,
          siteId: Number(siteId),
          siteLabel,
          requestedAt: result.audit.requested_at,
        });
        openReport(result.audit.id);
      }
      void refetch();
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "No se pudo generar el reporte",
        { type: "error" },
      );
    } finally {
      setIsEnqueueing(false);
    }
  };

  const loading = isPending || historyPending;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Web Report</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Reportes Lighthouse + hallazgos. Haz clic en uno para ver el informe
            completo.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
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
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando reportes…
          </p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
            <p className="text-sm font-medium">Sin reportes todavía</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera el primer reporte completo (móvil + desktop) para este
              sitio.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={isEnqueueing}
              onClick={() => void handleGenerate()}
            >
              <FileSearch className="mr-2 size-4" />
              Generar reporte
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row, index) => {
                const delta = deltaVsPreviousDone(history, index);
                const deltaText = formatDelta(delta);
                const isRunning =
                  row.status === "queued" || row.status === "running";

                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => openReport(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openReport(row.id);
                      }
                    }}
                  >
                    <TableCell className="text-muted-foreground">
                      {formatCheckedAt(row.requested_at)}
                    </TableCell>
                    <TableCell>{strategyLabel(row.strategy)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.status === "done" && row.overall_score != null ? (
                        <span className="font-medium">
                          {row.overall_score}
                          {deltaText != null ? (
                            <span
                              className={cn(
                                "ml-1.5 text-xs font-normal",
                                delta != null && delta > 0
                                  ? "text-emerald-600"
                                  : delta != null && delta < 0
                                    ? "text-red-600"
                                    : "text-muted-foreground",
                              )}
                            >
                              ({deltaText})
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "failed"
                            ? "destructive"
                            : isRunning
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {isRunning ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : null}
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
