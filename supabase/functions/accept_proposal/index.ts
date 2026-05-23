import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";

type AcceptProposalBody = {
  proposal_id: number;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const user = await AuthMiddleware(req);
      const member = await getUserOrganizationMember(user.id);
      if (!member?.id) {
        return createErrorResponse("Unauthorized", 401);
      }

      const body = (await req.json()) as AcceptProposalBody;
      const proposalId = Number(body.proposal_id);
      if (!Number.isFinite(proposalId)) {
        return createErrorResponse("Invalid proposal_id", 400);
      }

      const { data: proposal, error: proposalError } = await supabaseAdmin
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .eq("org_id", member.org_id)
        .single();

      if (proposalError || !proposal) {
        return createErrorResponse("Proposal not found", 404);
      }

      if (proposal.deal_id) {
        return new Response(
          JSON.stringify({ deal_id: proposal.deal_id, proposal_id: proposalId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const contactIds = proposal.contact_id ? [proposal.contact_id] : [];
      const { data: deal, error: dealError } = await supabaseAdmin
        .from("deals")
        .insert({
          org_id: member.org_id,
          organization_member_id: member.id,
          name: proposal.title,
          company_id: proposal.company_id,
          contact_id: proposal.contact_id,
          contact_ids: contactIds,
          stage: "setup",
          amount: proposal.amount ?? 0,
          estimated_value: proposal.amount ?? 0,
          description: proposal.notes ?? "",
          category: "website",
          project_type: "website",
          lifecycle_phase: "delivery",
          delivery_status: "planning",
          accepted_proposal_id: proposalId,
          priority: "normal",
        })
        .select("id")
        .single();

      if (dealError || !deal) {
        console.error("accept_proposal.deal_error", dealError);
        return createErrorResponse("Failed to create project", 500);
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("proposals")
        .update({
          status: "accepted",
          accepted_at: now,
          deal_id: deal.id,
          updated_at: now,
        })
        .eq("id", proposalId);

      if (updateError) {
        console.error("accept_proposal.update_error", updateError);
        return createErrorResponse("Failed to update proposal", 500);
      }

      if (proposal.contact_id) {
        await supabaseAdmin
          .from("contacts")
          .update({ status: "client" })
          .eq("id", proposal.contact_id);
      }

      return new Response(
        JSON.stringify({ deal_id: deal.id, proposal_id: proposalId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("accept_proposal.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
