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
  default_audit_schedule_enabled: boolean;
  default_audit_interval_days: number;
  default_audit_alert_on_score_drop: boolean;
  default_audit_score_drop_threshold: number;
};

export const DEFAULT_WEBSITE_MONITOR_SETTINGS: WebsiteMonitorOrgSettings = {
  enabled: true,
  sms_alerts_enabled: true,
  auto_sync: true,
  default_check_interval_minutes: 5,
  default_slow_threshold_ms: 3000,
  default_alert_on_down: true,
  default_alert_on_slow: false,
  default_alert_on_ssl: true,
  alert_cooldown_hours: 6,
  default_audit_schedule_enabled: false,
  default_audit_interval_days: 30,
  default_audit_alert_on_score_drop: true,
  default_audit_score_drop_threshold: 10,
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
      DEFAULT_WEBSITE_MONITOR_SETTINGS.default_check_interval_minutes,
    ),
    default_slow_threshold_ms: clampInt(
      value.default_slow_threshold_ms,
      500,
      120_000,
      DEFAULT_WEBSITE_MONITOR_SETTINGS.default_slow_threshold_ms,
    ),
    default_alert_on_down: value.default_alert_on_down !== false,
    default_alert_on_slow: value.default_alert_on_slow === true,
    default_alert_on_ssl: value.default_alert_on_ssl !== false,
    alert_cooldown_hours: clampInt(
      value.alert_cooldown_hours,
      1,
      168,
      DEFAULT_WEBSITE_MONITOR_SETTINGS.alert_cooldown_hours,
    ),
    default_audit_schedule_enabled: value.default_audit_schedule_enabled === true,
    default_audit_interval_days: clampInt(
      value.default_audit_interval_days,
      1,
      365,
      DEFAULT_WEBSITE_MONITOR_SETTINGS.default_audit_interval_days,
    ),
    default_audit_alert_on_score_drop:
      value.default_audit_alert_on_score_drop !== false,
    default_audit_score_drop_threshold: clampInt(
      value.default_audit_score_drop_threshold,
      1,
      100,
      DEFAULT_WEBSITE_MONITOR_SETTINGS.default_audit_score_drop_threshold,
    ),
  };
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
