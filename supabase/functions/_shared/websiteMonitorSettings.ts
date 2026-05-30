import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type WebsiteMonitorOrgSettings = {
  enabled: boolean;
  sms_alerts_enabled: boolean;
  auto_sync: boolean;
  default_check_interval_minutes: number;
  default_slow_threshold_ms: number;
  default_alert_on_down: boolean;
  default_alert_on_slow: boolean;
  default_alert_on_ssl: boolean;
  alert_cooldown_hours: number;
};

const DEFAULTS: WebsiteMonitorOrgSettings = {
  enabled: true,
  sms_alerts_enabled: true,
  auto_sync: true,
  default_check_interval_minutes: 5,
  default_slow_threshold_ms: 3000,
  default_alert_on_down: true,
  default_alert_on_slow: false,
  default_alert_on_ssl: true,
  alert_cooldown_hours: 6,
};

const clampInt = (
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

export const parseWebsiteMonitorSettings = (
  raw: unknown,
): WebsiteMonitorOrgSettings => {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    enabled: value.enabled !== false,
    sms_alerts_enabled: value.sms_alerts_enabled !== false,
    auto_sync: value.auto_sync !== false,
    default_check_interval_minutes: clampInt(
      value.default_check_interval_minutes,
      1,
      1440,
      DEFAULTS.default_check_interval_minutes,
    ),
    default_slow_threshold_ms: clampInt(
      value.default_slow_threshold_ms,
      500,
      120_000,
      DEFAULTS.default_slow_threshold_ms,
    ),
    default_alert_on_down: value.default_alert_on_down !== false,
    default_alert_on_slow: value.default_alert_on_slow === true,
    default_alert_on_ssl: value.default_alert_on_ssl !== false,
    alert_cooldown_hours: clampInt(
      value.alert_cooldown_hours,
      1,
      168,
      DEFAULTS.alert_cooldown_hours,
    ),
  };
};

export const getWebsiteMonitorSettings = async (
  supabase: SupabaseClient,
  orgId: number,
): Promise<WebsiteMonitorOrgSettings> => {
  const { data, error } = await supabase.rpc("get_website_monitor_settings", {
    target_org_id: orgId,
  });
  if (error) {
    console.error("get_website_monitor_settings", orgId, error);
    return DEFAULTS;
  }
  return parseWebsiteMonitorSettings(data);
};
