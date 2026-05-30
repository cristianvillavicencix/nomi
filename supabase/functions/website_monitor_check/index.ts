import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedFollowUpCron } from "../_shared/notifyFollowUp.ts";
import { runWebsiteMonitorCheck } from "../_shared/websiteMonitor.ts";
import {
  fetchWebsiteMonitorSite,
  persistWebsiteCheckResult,
} from "../_shared/persistWebsiteCheck.ts";

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
        include_deep_metadata?: boolean;
        app_base_url?: string | null;
      };
      try {
        payload = (await req.json()) as typeof payload;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      const siteId = Number(payload.monitored_website_id);
      if (!Number.isFinite(siteId) || siteId <= 0) {
        return createErrorResponse(400, "monitored_website_id is required");
      }

      const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
      const site = await fetchWebsiteMonitorSite(supabaseAdmin, siteId, orgId);
      if (!site) {
        return createErrorResponse(404, "Website not found");
      }

      const result = await runWebsiteMonitorCheck(site, {
        includeDeepMetadata: payload.include_deep_metadata ?? true,
      });
      await persistWebsiteCheckResult(
        supabaseAdmin,
        site,
        result,
        { appBaseUrl: appBaseUrl ?? payload.app_base_url ?? null },
      );

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

      const { getUserOrganizationMember } = await import(
        "../_shared/getUserOrganizationMember.ts"
      );
      const member = await getUserOrganizationMember(user);
      if (!member?.org_id) {
        return createErrorResponse(403, "Forbidden");
      }

      return handleCheck(req, member.org_id);
    });
  }),
);
