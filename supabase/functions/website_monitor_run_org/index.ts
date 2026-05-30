import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  isWebsiteDueForCheck,
  runWebsiteMonitorCheck,
  type WebsiteMonitorSiteRow,
} from "../_shared/websiteMonitor.ts";
import { persistWebsiteCheckResult } from "../_shared/persistWebsiteCheck.ts";
import { getWebsiteMonitorSettings } from "../_shared/websiteMonitorSettings.ts";

const SITE_SELECT =
  "id, org_id, url, display_name, slow_threshold_ms, is_enabled, check_interval_minutes, last_checked_at, last_status, check_paths, page_title, hosting_provider, tech_stack, ssl_days_remaining, dns_ip, alert_on_down, alert_on_slow, alert_on_ssl, last_alert_sent_at, last_alert_status";

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

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const { getUserOrganizationMember } = await import(
        "../_shared/getUserOrganizationMember.ts"
      );
      const member = await getUserOrganizationMember(user);
      if (!member?.org_id) {
        return createErrorResponse(403, "Forbidden");
      }

      let forceAll = false;
      let maxBatch = BATCH_SIZE;
      try {
        const body = await req.json();
        forceAll = Boolean(body?.force_all);
        const requested = Number(body?.max_batch);
        if (Number.isFinite(requested) && requested > 0) {
          maxBatch = Math.min(Math.round(requested), BATCH_SIZE);
        }
      } catch {
        forceAll = false;
      }

      const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
      const orgSettings = await getWebsiteMonitorSettings(
        supabaseAdmin,
        member.org_id,
      );
      if (!orgSettings.enabled) {
        return new Response(
          JSON.stringify({
            ok: true,
            checked: 0,
            failures: 0,
            due: 0,
            remaining: 0,
            disabled: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: sites, error } = await supabaseAdmin
        .from("monitored_websites")
        .select(SITE_SELECT)
        .eq("org_id", member.org_id)
        .eq("is_enabled", true);

      if (error) {
        return createErrorResponse(500, error.message);
      }

      const candidates = (sites ?? []) as WebsiteMonitorSiteRow[];
      const dueSites = sortDueSites(
        forceAll
          ? candidates
          : candidates.filter(
              (site) => isWebsiteDueForCheck(site) || !site.hosting_provider,
            ),
      );
      const batch = dueSites.slice(0, maxBatch);

      let checked = 0;
      let failures = 0;

      for (const site of batch) {
        try {
          const includeDeepMetadata =
            forceAll ||
            !site.last_checked_at ||
            !site.hosting_provider ||
            Date.now() - new Date(site.last_checked_at).getTime() >
              24 * 60 * 60 * 1000;
          const result = await runWebsiteMonitorCheck(site, {
            includeDeepMetadata,
          });
          await persistWebsiteCheckResult(supabaseAdmin, site, result);
          checked += 1;
        } catch (cause) {
          failures += 1;
          console.error("website_monitor_run_org", site.id, cause);
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
    });
  }),
);
