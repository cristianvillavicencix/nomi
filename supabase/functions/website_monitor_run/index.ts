import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedFollowUpCron } from "../_shared/notifyFollowUp.ts";
import {
  isWebsiteDueForCheck,
  runWebsiteMonitorCheck,
  type WebsiteMonitorSiteRow,
} from "../_shared/websiteMonitor.ts";
import { persistWebsiteCheckResult } from "../_shared/persistWebsiteCheck.ts";
import { getWebsiteMonitorSettings } from "../_shared/websiteMonitorSettings.ts";

const SITE_SELECT =
  "id, org_id, url, display_name, slow_threshold_ms, is_enabled, check_interval_minutes, last_checked_at, last_status, check_paths, page_title, hosting_provider, tech_stack, ssl_days_remaining, dns_ip, alert_on_down, alert_on_slow, alert_on_ssl, last_alert_sent_at, last_alert_status";

/** Keep each cron invocation under the edge function timeout (~150s). */
const BATCH_SIZE = 15;

const sortDueSites = (sites: WebsiteMonitorSiteRow[]) =>
  sites.slice().sort((a, b) => {
    const aMissingHosting = a.hosting_provider ? 1 : 0;
    const bMissingHosting = b.hosting_provider ? 1 : 0;
    if (aMissingHosting !== bMissingHosting) {
      return aMissingHosting - bMissingHosting;
    }
    const aLast = a.last_checked_at
      ? new Date(a.last_checked_at).getTime()
      : 0;
    const bLast = b.last_checked_at
      ? new Date(b.last_checked_at).getTime()
      : 0;
    return aLast - bLast;
  });

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedFollowUpCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
    const { data: sites, error } = await supabaseAdmin
      .from("monitored_websites")
      .select(SITE_SELECT)
      .eq("is_enabled", true)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) {
      return createErrorResponse(500, error.message);
    }

    const orgSettingsCache = new Map<number, Awaited<ReturnType<typeof getWebsiteMonitorSettings>>>();
    const isOrgMonitoringEnabled = async (orgId: number) => {
      if (!orgSettingsCache.has(orgId)) {
        orgSettingsCache.set(orgId, await getWebsiteMonitorSettings(supabaseAdmin, orgId));
      }
      return orgSettingsCache.get(orgId)?.enabled !== false;
    };

    const enabledSites = [];
    for (const site of (sites ?? []) as WebsiteMonitorSiteRow[]) {
      if (await isOrgMonitoringEnabled(site.org_id)) {
        enabledSites.push(site);
      }
    }

    const dueSites = sortDueSites(
      enabledSites.filter(
        (site) => isWebsiteDueForCheck(site) || !site.hosting_provider,
      ),
    );
    const batch = dueSites.slice(0, BATCH_SIZE);

    let checked = 0;
    let failures = 0;

    for (const site of batch) {
      try {
        const includeDeepMetadata =
          !site.last_checked_at ||
          !site.hosting_provider ||
          Date.now() - new Date(site.last_checked_at).getTime() >
            24 * 60 * 60 * 1000;
        const result = await runWebsiteMonitorCheck(site, { includeDeepMetadata });
        await persistWebsiteCheckResult(supabaseAdmin, site, result);
        checked += 1;
      } catch (cause) {
        failures += 1;
        console.error("website_monitor_run", site.id, cause);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        checked,
        failures,
        due: dueSites.length,
        remaining: Math.max(0, dueSites.length - checked),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }),
);
