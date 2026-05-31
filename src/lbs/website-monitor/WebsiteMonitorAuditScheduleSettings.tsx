import { useState } from "react";
import { Link } from "react-router";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { CalendarClock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";

type AuditScheduleField =
  | "audit_schedule_enabled"
  | "audit_alert_on_score_drop";

export const WebsiteMonitorAuditScheduleSettings = ({
  site,
}: {
  site: MonitoredWebsite;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [pendingField, setPendingField] = useState<
    | AuditScheduleField
    | "audit_interval_days"
    | "audit_score_drop_threshold"
    | null
  >(null);

  const handleToggle = async (field: AuditScheduleField, checked: boolean) => {
    setPendingField(field);
    try {
      await update(
        "monitored_websites",
        {
          id: site.id,
          data: { [field]: checked },
          previousData: site,
        },
        { mutationMode: "optimistic" },
      );
      notify(checked ? "Programación activada" : "Programación desactivada", {
        type: "info",
      });
      refresh();
    } catch {
      notify("No se pudo guardar la preferencia", { type: "error" });
    } finally {
      setPendingField(null);
    }
  };

  const handleNumberChange = async (
    field: "audit_interval_days" | "audit_score_drop_threshold",
    raw: string,
    min: number,
    max: number,
    fallback: number,
  ) => {
    const parsed = Number(raw);
    const value = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, Math.round(parsed)))
      : fallback;

    setPendingField(field);
    try {
      await update(
        "monitored_websites",
        {
          id: site.id,
          data: { [field]: value },
          previousData: site,
        },
        { mutationMode: "optimistic" },
      );
      refresh();
    } catch {
      notify("No se pudo guardar", { type: "error" });
    } finally {
      setPendingField(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" />
          Web Report programado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Genera reportes Lighthouse automáticamente cada N días. Los defaults
          globales están en{" "}
          <Link
            to="/settings?tab=web-monitor"
            className="font-medium underline"
          >
            Settings → Web Monitor
          </Link>
          .
        </p>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-3">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="audit-schedule-enabled" className="text-sm">
              Reportes automáticos
            </Label>
            <p className="text-xs text-muted-foreground">
              Encola un Web Report cuando pasen los días configurados desde el
              último reporte completado.
            </p>
          </div>
          <Switch
            id="audit-schedule-enabled"
            checked={site.audit_schedule_enabled === true}
            disabled={pendingField === "audit_schedule_enabled"}
            onCheckedChange={(value) =>
              void handleToggle("audit_schedule_enabled", value)
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="audit-interval-days">Intervalo (días)</Label>
            <Input
              id="audit-interval-days"
              type="number"
              min={1}
              max={365}
              disabled={
                !site.audit_schedule_enabled ||
                pendingField === "audit_interval_days"
              }
              value={site.audit_interval_days ?? 30}
              onChange={(event) =>
                void handleNumberChange(
                  "audit_interval_days",
                  event.target.value,
                  1,
                  365,
                  30,
                )
              }
            />
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <TrendingDown className="size-4" />
            Alerta por caída de score
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="audit-score-drop-alert" className="text-sm">
                SMS si baja el score
              </Label>
              <p className="text-xs text-muted-foreground">
                Compara con el reporte anterior completado. Requiere Twilio y
                teléfono en Perfil.
              </p>
            </div>
            <Switch
              id="audit-score-drop-alert"
              checked={site.audit_alert_on_score_drop !== false}
              disabled={pendingField === "audit_alert_on_score_drop"}
              onCheckedChange={(value) =>
                void handleToggle("audit_alert_on_score_drop", value)
              }
            />
          </div>
          <div className="mt-3 space-y-2">
            <Label htmlFor="audit-score-threshold">
              Umbral de caída (puntos)
            </Label>
            <Input
              id="audit-score-threshold"
              type="number"
              min={1}
              max={100}
              disabled={
                site.audit_alert_on_score_drop === false ||
                pendingField === "audit_score_drop_threshold"
              }
              value={site.audit_score_drop_threshold ?? 10}
              onChange={(event) =>
                void handleNumberChange(
                  "audit_score_drop_threshold",
                  event.target.value,
                  1,
                  100,
                  10,
                )
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
