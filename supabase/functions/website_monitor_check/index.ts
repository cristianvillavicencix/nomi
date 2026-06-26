import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isAuthorizedFollowUpCron } from "../_shared/notifyFollowUp.ts";
import {
  normalizeMonitorUrl,
  runWebsiteMonitorCheck,
  type WebsiteMonitorSiteRow,
} from "../_shared/websiteMonitor.ts";
import {
  fetchWebsiteMonitorSite,
  persistWebsiteCheckResult,
} from "../_shared/persistWebsiteCheck.ts";

const AD_HOC_SLOW_THRESHOLD_MS = 3000;

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    const handleCheck = async (
      req: Request,
      orgId?: number,
      appBaseUrl?: string | null,
    ) => {
      let payload: {
        monitored_website_id?: number;
        url?: string;
        include_deep_metadata?: boolean;
        app_base_url?: string | null;
      };
      try {
        payload = (await req.json()) as typeof payload;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      // Ad-hoc mode: { url } provided without monitored_website_id.
      // Runs the check against the URL and returns the result WITHOUT persisting
      // anything. Used by the manual Quick Check UI.
      if (
        payload.url &&
        (!payload.monitored_website_id ||
          Number(payload.monitored_website_id) <= 0)
      ) {
        const normalized = normalizeMonitorUrl(payload.url);
        if (!normalized) {
          return createErrorResponse(400, "Invalid url");
        }

        const mockSite: WebsiteMonitorSiteRow = {
          id: 0,
          org_id: orgId ?? 0,
          url: normalized,
          slow_threshold_ms: AD_HOC_SLOW_THRESHOLD_MS,
          is_enabled: true,
          check_interval_minutes: 60,
          last_checked_at: null,
          check_paths: ["/"],
        };

        const result = await runWebsiteMonitorCheck(mockSite, {
          includeDeepMetadata: payload.include_deep_metadata ?? true,
        });

        return new Response(
          JSON.stringify({
            ok: true,
            ad_hoc: true,
            url: normalized,
            ...result,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const siteId = Number(payload.monitored_website_id);
      if (!Number.isFinite(siteId) || siteId <= 0) {
        return createErrorResponse(
          400,
          "monitored_website_id or url is required",
        );
      }

      const site = await fetchWebsiteMonitorSite(supabaseAdmin, siteId, orgId);
      if (!site) {
        return createErrorResponse(404, "Website not found");
      }

      const result = await runWebsiteMonitorCheck(site, {
        includeDeepMetadata: payload.include_deep_metadata ?? true,
      });
      await persistWebsiteCheckResult(supabaseAdmin, site, result, {
        appBaseUrl: appBaseUrl ?? payload.app_base_url ?? null,
      });

      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    if (isAuthorizedFollowUpCron(req)) {
      return handleCheck(req);
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      if (!member?.org_id) {
        return createErrorResponse(403, "Forbidden");
      }

      return handleCheck(req, member.org_id);
    });
  }),
);
