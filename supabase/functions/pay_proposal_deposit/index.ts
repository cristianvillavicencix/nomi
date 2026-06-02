import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  activateAcceptedDeal,
  recordProposalDepositPaid,
} from "../_shared/proposalFlow.ts";

type PayProposalDepositBody = {
  proposal_id: number;
  public_token: string;
};

const isStripeMockMode = () => {
  const skip =
    Deno.env.get("SKIP_CLIENT_BILLING") === "1" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "true" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "yes" ||
    Deno.env.get("SKIP_CLIENT_BILLING") === "on";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  return skip || !stripeKey;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as PayProposalDepositBody;
      const proposalId = Number(body.proposal_id);
      const token = String(body.public_token ?? "").trim();

      if (!Number.isFinite(proposalId) || !token) {
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
          "id, org_id, contract_id, contact_id, deal_id, accepted_at, amount",
        )
        .eq("id", proposalId)
        .maybeSingle();

      if (!proposal?.accepted_at || !proposal.contract_id || !proposal.deal_id) {
        return createErrorResponse(
          400,
          "Proposal must be accepted and signed before paying the deposit",
        );
      }

      const { data: contract } = await supabaseAdmin
        .from("contracts")
        .select("id, status, signed_at, deposit_paid_at")
        .eq("id", proposal.contract_id)
        .maybeSingle();

      if (!contract?.signed_at) {
        return createErrorResponse(400, "Contract must be signed first");
      }

      if (contract.deposit_paid_at) {
        return new Response(
          JSON.stringify({
            deal_id: proposal.deal_id,
            contract_id: proposal.contract_id,
            deposit_paid_at: contract.deposit_paid_at,
            already_paid: true,
            billing_mode: isStripeMockMode() ? "mock" : "stripe",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!isStripeMockMode()) {
        return createErrorResponse(
          501,
          "Stripe checkout is not configured yet. Contact your LBS representative.",
        );
      }

      const paymentMethod = "mock";
      await recordProposalDepositPaid(
        supabaseAdmin,
        proposalId,
        proposal.contract_id,
        proposal.deal_id,
        paymentMethod,
      );

      await activateAcceptedDeal(
        supabaseAdmin,
        proposal.deal_id,
        proposalId,
        proposal.amount ?? 0,
      );

      if (proposal.contact_id) {
        await supabaseAdmin
          .from("contacts")
          .update({ status: "client", lead_stage: "won" })
          .eq("id", proposal.contact_id);
      }

      const now = new Date().toISOString();

      return new Response(
        JSON.stringify({
          deal_id: proposal.deal_id,
          contract_id: proposal.contract_id,
          deposit_paid_at: now,
          already_paid: false,
          billing_mode: "mock",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("pay_proposal_deposit.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
