import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type PublicDealBriefBody = {
  deal_id?: number;
  company_id?: number;
  contact_id?: number;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as PublicDealBriefBody;
      const dealId = Number(body.deal_id);
      const companyId = Number(body.company_id);
      const contactId = Number(body.contact_id);

      if (
        !Number.isFinite(dealId) ||
        !Number.isFinite(companyId) ||
        !Number.isFinite(contactId)
      ) {
        return createErrorResponse("Missing deal, company, or contact", 400);
      }

      const { data: deal, error } = await supabaseAdmin
        .from("deals")
        .select(
          "id, company_id, contact_id, contact_ids, project_type, expected_end_date, website_brief",
        )
        .eq("id", dealId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error || !deal?.id) {
        return createErrorResponse("Project not found", 404);
      }

      const contactIds = Array.isArray(deal.contact_ids)
        ? deal.contact_ids
        : [];
      const matchesContact =
        Number(deal.contact_id) === contactId ||
        contactIds.map(Number).includes(contactId);

      if (!matchesContact) {
        return createErrorResponse("Contact does not match project", 403);
      }

      return new Response(
        JSON.stringify({
          project_type: deal.project_type,
          expected_end_date: deal.expected_end_date,
          website_brief: deal.website_brief ?? {},
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("get_public_deal_brief.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
