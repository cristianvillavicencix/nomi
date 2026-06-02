import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { markDealPendingPayment } from "../_shared/proposalFlow.ts";

type SignProposalContractBody = {
  proposal_id: number;
  public_token: string;
  signatory_name: string;
};

const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  null;

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as SignProposalContractBody;
      const proposalId = Number(body.proposal_id);
      const token = String(body.public_token ?? "").trim();
      const signatoryName = String(body.signatory_name ?? "").trim();

      if (!Number.isFinite(proposalId) || !token || !signatoryName) {
        return createErrorResponse(400, "Missing required fields");
      }

      const { data: tokenRow } = await supabaseAdmin
        .from("public_proposal_tokens")
        .select("*")
        .eq("token", token)
        .eq("proposal_id", proposalId)
        .maybeSingle();

      if (!tokenRow) {
        return createErrorResponse(403, "Invalid or expired link");
      }

      const { data: proposal } = await supabaseAdmin
        .from("proposals")
        .select(
          "id, org_id, contract_id, contact_id, deal_id, status, accepted_at, amount",
        )
        .eq("id", proposalId)
        .maybeSingle();

      if (!proposal?.contract_id || !proposal.accepted_at) {
        return createErrorResponse(
          400,
          "Proposal must be accepted before signing",
        );
      }

      const now = new Date().toISOString();
      const ip = clientIp(req);

      await supabaseAdmin
        .from("contracts")
        .update({
          status: "signed",
          signed_at: now,
          signed_ip: ip,
          signatory_name: signatoryName,
          signed_by_contact_id: proposal.contact_id,
          updated_at: now,
        })
        .eq("id", proposal.contract_id);

      if (proposal.deal_id) {
        await markDealPendingPayment(
          supabaseAdmin,
          proposal.deal_id,
          proposalId,
          proposal.amount ?? 0,
        );
      }

      if (proposal.contact_id) {
        await supabaseAdmin
          .from("contacts")
          .update({ lead_stage: "closing" })
          .eq("id", proposal.contact_id);
      }

      return new Response(
        JSON.stringify({
          contract_id: proposal.contract_id,
          signed_at: now,
          deal_id: proposal.deal_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("sign_proposal_contract.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
