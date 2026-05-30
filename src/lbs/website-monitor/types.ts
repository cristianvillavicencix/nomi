import type { Identifier } from "ra-core";

export type WebsiteMonitorStatus = "up" | "slow" | "down" | "unknown";

export type MonitoredWebsite = {
  id: Identifier;
  org_id: Identifier;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  url: string;
  display_name?: string | null;
  source: "company" | "contact" | "manual";
  is_enabled: boolean;
  slow_threshold_ms: number;
  check_interval_minutes: number;
  check_paths?: string[];
  last_status: WebsiteMonitorStatus;
  last_response_ms?: number | null;
  last_http_status?: number | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  page_title?: string | null;
  domain_name?: string | null;
  resolved_domain?: string | null;
  ssl_expires_at?: string | null;
  ssl_days_remaining?: number | null;
  dns_ip?: string | null;
  dns_nameservers?: string[];
  dns_mx?: string[];
  hosting_provider?: string | null;
  hosting_confidence?: "low" | "medium" | "high" | null;
  tech_stack?: string[];
  metadata?: Record<string, unknown> & {
    pages?: Array<{
      path: string;
      url: string;
      status: WebsiteMonitorStatus;
      responseMs?: number | null;
      httpStatus?: number | null;
      errorMessage?: string | null;
    }>;
    dns?: { registrar?: string | null };
  };
  notes?: string | null;
  alert_on_down?: boolean;
  alert_on_slow?: boolean;
  alert_on_ssl?: boolean;
  company_name?: string | null;
  company_sector?: string | null;
  uptime_pct_7d?: number | null;
  avg_response_ms_7d?: number | null;
  changes_30d?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type WebsiteCheck = {
  id: Identifier;
  org_id: Identifier;
  monitored_website_id: Identifier;
  checked_at: string;
  status: Exclude<WebsiteMonitorStatus, "unknown">;
  response_ms?: number | null;
  http_status?: number | null;
  error_message?: string | null;
  ssl_days_remaining?: number | null;
  metadata?: Record<string, unknown>;
};

export type WebsiteMonitorChange = {
  id: Identifier;
  org_id: Identifier;
  monitored_website_id: Identifier;
  detected_at: string;
  change_type:
    | "status"
    | "hosting"
    | "tech_stack"
    | "ssl"
    | "page_title"
    | "dns"
    | "response_time";
  previous_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown>;
};
