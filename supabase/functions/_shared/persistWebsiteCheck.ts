import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  detectWebsiteChanges,
  type WebsiteCheckResult,
  type WebsiteMonitorSiteRow,
} from "./websiteMonitor.ts";
import { notifyWebsiteMonitorAlert } from "./notifyWebsiteMonitor.ts";

export const persistWebsiteCheckResult = async (
  supabase: SupabaseClient,
  site: WebsiteMonitorSiteRow,
  result: WebsiteCheckResult,
  options?: { appBaseUrl?: string | null },
) => {
  await supabase.from("website_checks").insert({
    org_id: site.org_id,
    monitored_website_id: site.id,
    status: result.status,
    response_ms: result.responseMs,
    http_status: result.httpStatus,
    error_message: result.errorMessage,
    ssl_days_remaining: result.sslDaysRemaining,
    metadata: result.metadata,
  });

  const changes = detectWebsiteChanges(site, result);
  if (changes.length) {
    await supabase.from("website_monitor_changes").insert(
      changes.map((change) => ({
        org_id: site.org_id,
        monitored_website_id: site.id,
        change_type: change.change_type,
        previous_value: change.previous_value,
        new_value: change.new_value,
      })),
    );
  }

  await supabase
    .from("monitored_websites")
    .update({
      last_status: result.status,
      last_response_ms: result.responseMs,
      last_http_status: result.httpStatus,
      last_checked_at: new Date().toISOString(),
      last_error: result.errorMessage,
      hosting_provider: result.hostingProvider,
      hosting_confidence: result.hostingConfidence,
      tech_stack: result.techStack,
      page_title: result.pageTitle,
      domain_name: result.domainName,
      metadata: result.metadata,
      updated_at: new Date().toISOString(),
      ...(result.sslDaysRemaining != null
        ? {
            ssl_expires_at: result.sslExpiresAt,
            ssl_days_remaining: result.sslDaysRemaining,
          }
        : {}),
      ...(result.dnsIp != null
        ? {
            dns_ip: result.dnsIp,
            dns_nameservers: result.dnsNameservers,
            dns_mx: result.dnsMx,
          }
        : {}),
    })
    .eq("id", site.id);

  await notifyWebsiteMonitorAlert(supabase, site, result, options);
};

export const fetchWebsiteMonitorSite = async (
  supabase: SupabaseClient,
  siteId: number,
  orgId?: number,
) => {
  let query = supabase
    .from("monitored_websites")
    .select(
      "id, org_id, url, display_name, slow_threshold_ms, is_enabled, check_interval_minutes, last_checked_at, last_status, check_paths, page_title, hosting_provider, tech_stack, ssl_days_remaining, dns_ip, alert_on_down, alert_on_slow, alert_on_ssl, last_alert_sent_at, last_alert_status",
    )
    .eq("id", siteId);

  if (orgId != null) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as WebsiteMonitorSiteRow | null;
};
