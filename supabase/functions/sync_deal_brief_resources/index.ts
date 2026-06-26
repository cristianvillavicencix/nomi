import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { syncBriefAssetsToDealResources } from "../_shared/formV2ProjectBrief.ts";

type SyncDealBriefResourcesBody = {
  deal_id?: number;
};

Deno.serve(
  OptionsMiddleware(
    UserMiddleware(async (req, user) => {
      if (req.method !== "POST") {
        return createErrorResponse(405, "Method not allowed");
      }

      try {
        const body = (await req.json()) as SyncDealBriefResourcesBody;
        const dealId = Number(body.deal_id);
        if (!Number.isFinite(dealId)) {
          return createErrorResponse(400, "Missing deal_id");
        }

        const member = await getUserOrganizationMember(user.id);
        if (!member?.org_id) {
          return createErrorResponse(403, "Organization membership required");
        }

        const { data: deal, error: dealError } = await supabaseAdmin
          .from("deals")
          .select("id, org_id, website_brief")
          .eq("id", dealId)
          .maybeSingle();

        if (dealError || !deal) {
          return createErrorResponse(404, "Deal not found");
        }

        if (Number(deal.org_id) !== Number(member.org_id)) {
          return createErrorResponse(404, "Deal not found");
        }

        const brief =
          deal.website_brief &&
          typeof deal.website_brief === "object" &&
          !Array.isArray(deal.website_brief)
            ? (deal.website_brief as Record<string, unknown>)
            : {};

        const result = await syncBriefAssetsToDealResources(supabaseAdmin, {
          orgId: Number(deal.org_id),
          dealId,
          answers: brief,
          source: "project_brief",
        });

        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("sync_deal_brief_resources", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to sync brief assets";
        return createErrorResponse(500, message);
      }
    }),
  ),
);
