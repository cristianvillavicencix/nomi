import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type ClientPortalBody = {
  token?: string;
  deal_id?: number;
};

const sanitizeDeal = (deal: Record<string, unknown>) => ({
  id: deal.id,
  name: deal.name,
  stage: deal.stage,
  project_type: deal.project_type,
  expected_end_date: deal.expected_end_date,
  production_url: deal.production_url,
  staging_url: deal.staging_url,
});

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as ClientPortalBody;
      const token = body.token?.trim();
      if (!token) {
        return createErrorResponse("Missing portal token", 400);
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from("client_portal_accounts")
        .select("id, org_id, email, active")
        .eq("invitation_token", token)
        .eq("active", true)
        .maybeSingle();

      if (accountError || !account?.id) {
        return createErrorResponse("Invalid or expired portal link", 403);
      }

      await supabaseAdmin
        .from("client_portal_accounts")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", account.id);

      if (body.deal_id) {
        const dealId = Number(body.deal_id);
        const { data: access } = await supabaseAdmin
          .from("client_portal_deal_access")
          .select("deal_id")
          .eq("portal_account_id", account.id)
          .eq("deal_id", dealId)
          .maybeSingle();

        if (!access?.deal_id) {
          return createErrorResponse("Project not shared with this client", 403);
        }

        const { data: deal, error: dealError } = await supabaseAdmin
          .from("deals")
          .select(
            "id, name, stage, project_type, expected_end_date, production_url, staging_url, website_brief",
          )
          .eq("id", dealId)
          .eq("org_id", account.org_id)
          .maybeSingle();

        if (dealError || !deal) {
          return createErrorResponse("Project not found", 404);
        }

        const { data: approvals = [] } = await supabaseAdmin
          .from("deal_approvals")
          .select(
            "id, title, description, resource_type, resource_url, status, created_at, expires_at",
          )
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false })
          .limit(20);

        return new Response(
          JSON.stringify({
            account: { email: account.email },
            project: sanitizeDeal(deal as Record<string, unknown>),
            approvals,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: accessRows = [] } = await supabaseAdmin
        .from("client_portal_deal_access")
        .select("deal_id")
        .eq("portal_account_id", account.id);

      const dealIds = accessRows.map((row) => row.deal_id).filter(Boolean);
      if (dealIds.length === 0) {
        return new Response(
          JSON.stringify({ account: { email: account.email }, projects: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: deals = [] } = await supabaseAdmin
        .from("deals")
        .select(
          "id, name, stage, project_type, expected_end_date, production_url, staging_url",
        )
        .in("id", dealIds)
        .eq("org_id", account.org_id)
        .is("archived_at", null);

      return new Response(
        JSON.stringify({
          account: { email: account.email },
          projects: deals.map((deal) => sanitizeDeal(deal as Record<string, unknown>)),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("client_portal.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
