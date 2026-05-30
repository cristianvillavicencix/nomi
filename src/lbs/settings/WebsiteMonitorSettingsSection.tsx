import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Link } from "react-router";
import { useGetList, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  DEFAULT_WEBSITE_MONITOR_SETTINGS,
  type WebsiteMonitorOrgSettings,
} from "@/lbs/website-monitor/websiteMonitorSettings";
import { getWebMonitorPath } from "@/lbs/routing";
import { useWebsiteMonitorSettings } from "@/lbs/settings/useWebsiteMonitorSettings";

export const WebsiteMonitorSettingsSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const canManage = useMemberCapability("admin.settings.manage");
  const { data: orgSettings, isPending } = useWebsiteMonitorSettings(canManage);

  const [settings, setSettings] = useState<WebsiteMonitorOrgSettings>(
    DEFAULT_WEBSITE_MONITOR_SETTINGS,
  );

  useEffect(() => {
    if (!orgSettings) return;
    setSettings(orgSettings.website_monitor_settings);
  }, [orgSettings]);

  const { total: monitoredCount = 0 } = useGetList(
    "monitored_websites",
    {
      filter: { "is_enabled@eq": true },
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canManage },
  );

  const patchSetting = <K extends keyof WebsiteMonitorOrgSettings>(
    key: K,
    value: WebsiteMonitorOrgSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (orgSettings?.id == null) {
        throw new Error("Organization not loaded");
      }

      const { data, error } = await supabase
        .from("organizations")
        .update({ website_monitor_settings: settings })
        .eq("id", orgSettings.id)
        .select("id, website_monitor_settings")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["organization-website-monitor-settings"],
      });
      notify("Configuración de Web Monitor guardada", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración",
        { type: "error" },
      );
    },
  });

  const applyDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (orgSettings?.id == null) {
        throw new Error("Organization not loaded");
      }

      const { error } = await supabase
        .from("monitored_websites")
        .update({
          alert_on_down: settings.default_alert_on_down,
          alert_on_slow: settings.default_alert_on_slow,
          alert_on_ssl: settings.default_alert_on_ssl,
          check_interval_minutes: settings.default_check_interval_minutes,
          slow_threshold_ms: settings.default_slow_threshold_ms,
        })
        .eq("org_id", orgSettings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      notify("Defaults aplicados a todos los sitios monitoreados", {
        type: "success",
      });
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudieron aplicar los defaults",
        { type: "error" },
      );
    },
  });

  const summary = useMemo(
    () => [
      settings.enabled ? "Módulo activo" : "Módulo pausado",
      settings.sms_alerts_enabled ? "SMS activos" : "SMS desactivados",
      settings.auto_sync ? "Sync automático" : "Sync manual",
    ],
    [settings],
  );

  if (!canManage) {
    return (
      <div className="max-w-3xl rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Solo administradores pueden configurar Web Monitor.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando configuración de Web Monitor…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Web Monitor
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Control del módulo, chequeos automáticos y alertas SMS para sitios
            caídos, lentos o SSL por vencer.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.join(" · ")} · {monitoredCount} sitio
            {monitoredCount === 1 ? "" : "s"} activo
            {monitoredCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={getWebMonitorPath()}>Abrir Web Monitor</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulo</CardTitle>
          <CardDescription>
            Pausa todo el monitoreo y oculta el módulo del menú lateral.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            id="wm-enabled"
            label="Web Monitor activo"
            description="Chequeos automáticos cada pocos minutos y acceso al módulo."
            checked={settings.enabled}
            onCheckedChange={(checked) => patchSetting("enabled", checked)}
          />
          <SettingRow
            id="wm-auto-sync"
            label="Sincronizar sitios desde clientes"
            description="Agrega o actualiza URLs automáticamente al guardar empresas con sitio web."
            checked={settings.auto_sync}
            disabled={!settings.enabled}
            onCheckedChange={(checked) => patchSetting("auto_sync", checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones SMS</CardTitle>
          <CardDescription>
            Requiere Twilio en{" "}
            <Link to="/settings?tab=messaging" className="underline">
              Communications
            </Link>{" "}
            y teléfono en{" "}
            <Link to="/profile" className="underline">
              Perfil → Notificaciones
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            id="wm-sms-enabled"
            label="Alertas SMS activas"
            description="Interruptor global. Si está off, no se envían SMS aunque un sitio tenga alertas on."
            checked={settings.sms_alerts_enabled}
            disabled={!settings.enabled}
            onCheckedChange={(checked) =>
              patchSetting("sms_alerts_enabled", checked)
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wm-cooldown-hours">
                Espera entre SMS (horas)
              </Label>
              <Input
                id="wm-cooldown-hours"
                type="number"
                min={1}
                max={168}
                disabled={!settings.enabled || !settings.sms_alerts_enabled}
                value={settings.alert_cooldown_hours}
                onChange={(event) =>
                  patchSetting(
                    "alert_cooldown_hours",
                    Number(event.target.value) || 6,
                  )
                }
              />
            </div>
          </div>
          <SettingRow
            id="wm-default-down"
            label="Default: sitio caído"
            description="Para sitios nuevos. También editable por sitio en el detalle."
            checked={settings.default_alert_on_down}
            disabled={!settings.enabled || !settings.sms_alerts_enabled}
            onCheckedChange={(checked) =>
              patchSetting("default_alert_on_down", checked)
            }
          />
          <SettingRow
            id="wm-default-slow"
            label="Default: sitio lento"
            checked={settings.default_alert_on_slow}
            disabled={!settings.enabled || !settings.sms_alerts_enabled}
            onCheckedChange={(checked) =>
              patchSetting("default_alert_on_slow", checked)
            }
          />
          <SettingRow
            id="wm-default-ssl"
            label="Default: SSL por vencer"
            checked={settings.default_alert_on_ssl}
            disabled={!settings.enabled || !settings.sms_alerts_enabled}
            onCheckedChange={(checked) =>
              patchSetting("default_alert_on_ssl", checked)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chequeos</CardTitle>
          <CardDescription>
            Valores por defecto para sitios nuevos sincronizados desde clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wm-interval">Intervalo (minutos)</Label>
            <Input
              id="wm-interval"
              type="number"
              min={1}
              max={1440}
              disabled={!settings.enabled}
              value={settings.default_check_interval_minutes}
              onChange={(event) =>
                patchSetting(
                  "default_check_interval_minutes",
                  Number(event.target.value) || 5,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wm-slow-ms">Umbral lento (ms)</Label>
            <Input
              id="wm-slow-ms"
              type="number"
              min={500}
              max={120000}
              step={100}
              disabled={!settings.enabled}
              value={settings.default_slow_threshold_ms}
              onChange={(event) =>
                patchSetting(
                  "default_slow_threshold_ms",
                  Number(event.target.value) || 3000,
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Guardar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!settings.enabled || applyDefaultsMutation.isPending}
          onClick={() => applyDefaultsMutation.mutate()}
        >
          Aplicar defaults a todos los sitios
        </Button>
      </div>
    </div>
  );
};

const SettingRow = ({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-3">
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
    <Switch
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  </div>
);
