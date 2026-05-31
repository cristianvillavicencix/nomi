import { useState } from "react";
import { Link } from "react-router";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { Bell, BellOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";

type AlertField = "alert_on_down" | "alert_on_slow" | "alert_on_ssl";

const ALERT_OPTIONS: Array<{
  field: AlertField;
  label: string;
  description: string;
  defaultOn: boolean;
}> = [
  {
    field: "alert_on_down",
    label: "Sitio caído",
    description:
      "SMS cuando el sitio pasa a DOWN (no en cada chequeo mientras siga caído).",
    defaultOn: true,
  },
  {
    field: "alert_on_slow",
    label: "Sitio lento",
    description: "SMS cuando el sitio pasa a lento por primera vez.",
    defaultOn: false,
  },
  {
    field: "alert_on_ssl",
    label: "SSL por vencer",
    description: "SMS cuando el certificado entra en ventana de 14 días.",
    defaultOn: true,
  },
];

export const WebsiteMonitorAlertSettings = ({
  site,
}: {
  site: MonitoredWebsite;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [pendingField, setPendingField] = useState<AlertField | null>(null);

  const alertsEnabled = ALERT_OPTIONS.some(
    (option) => (site[option.field] ?? option.defaultOn) === true,
  );

  const handleToggle = async (field: AlertField, checked: boolean) => {
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
      notify(checked ? "Alerta activada" : "Alerta desactivada", {
        type: "info",
      });
      refresh();
    } catch {
      notify("No se pudo guardar la preferencia", { type: "error" });
    } finally {
      setPendingField(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {alertsEnabled ? (
            <Bell className="size-4" />
          ) : (
            <BellOff className="size-4 text-muted-foreground" />
          )}
          Alertas SMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Los SMS van a los administradores con teléfono en{" "}
          <Link to="/profile" className="font-medium text-foreground underline">
            Perfil → Notificaciones
          </Link>
          . La configuración global está en{" "}
          <Link
            to="/settings?tab=web-monitor"
            className="font-medium text-foreground underline"
          >
            Settings → Web Monitor
          </Link>
          .
        </p>
        {ALERT_OPTIONS.map((option) => {
          const checked = site[option.field] ?? option.defaultOn;
          return (
            <div
              key={option.field}
              className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-3"
            >
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`alert-${option.field}`} className="text-sm">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <Switch
                id={`alert-${option.field}`}
                checked={checked}
                disabled={pendingField === option.field}
                onCheckedChange={(value) =>
                  void handleToggle(option.field, value)
                }
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
