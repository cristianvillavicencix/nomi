import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import {
  activateAcceptedDeal,
  createContractFromProposal,
  resolveDealForProposal,
  syncInstallmentsToDealPayments,
  syncRecurringToRetainers,
} from "../_shared/proposalFlow.ts";

type AcceptProposalBody = {
  proposal_id: number;
  public_token?: string;
};

const validatePublicToken = async (proposalId: number, token: string) => {
  const { data: tokenRow } = await supabaseAdmin
    .from("public_proposal_tokens")
    .select("*")
    .eq("token", token)
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (!tokenRow) return false;
  if (
    tokenRow.expires_at &&
    new Date(tokenRow.expires_at).getTime() < Date.now()
  ) {
    return false;
  }
  return true;
};

const acceptProposalCore = async (
  proposalId: number,
  memberId?: number | null,
) => {
  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    throw new Error("Proposal not found");
  }

  if (proposal.accepted_at && proposal.deal_id) {
    return {
      deal_id: proposal.deal_id,
      proposal_id: proposalId,
      contract_id: proposal.contract_id ?? null,
      already_accepted: true,
    };
  }

  const dealId = await resolveDealForProposal(
    supabaseAdmin,
    proposal,
    memberId,
  );

  const [{ data: lineItems }, { data: schedule }, { data: installments }] =
    await Promise.all([
      supabaseAdmin
        .from("proposal_line_items")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("proposal_payment_schedules")
        .select("id")
        .eq("proposal_id", proposalId)
        .maybeSingle(),
      supabaseAdmin
        .from("proposal_payment_installments")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("installment_number", { ascending: true }),
    ]);

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("proposals")
    .update({
      status: "accepted",
      accepted_at: now,
      deal_id: dealId,
      updated_at: now,
    })
    .eq("id", proposalId);

  await activateAcceptedDeal(
    supabaseAdmin,
    dealId,
    proposalId,
    proposal.amount ?? 0,
  );

  const contractId = await createContractFromProposal(
    supabaseAdmin,
    { ...proposal, deal_id: dealId },
    dealId,
    lineItems ?? [],
    installments ?? [],
    schedule?.id ?? null,
  );

  await syncInstallmentsToDealPayments(
    supabaseAdmin,
    dealId,
    installments ?? [],
  );
  await syncRecurringToRetainers(
    supabaseAdmin,
    proposal.org_id,
    dealId,
    proposal.recurring_summary,
  );

  if (proposal.contact_id) {
    await supabaseAdmin
      .from("contacts")
      .update({ status: "client", lead_stage: "won" })
      .eq("id", proposal.contact_id);
  }

  return {
    deal_id: dealId,
    proposal_id: proposalId,
    contract_id: contractId,
    already_accepted: false,
  };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as AcceptProposalBody;
      const proposalId = Number(body.proposal_id);
      if (!Number.isFinite(proposalId)) {
        return createErrorResponse(400, "Invalid proposal_id");
      }

      let memberId: number | null = null;

      if (body.public_token) {
        const valid = await validatePublicToken(proposalId, body.public_token);
        if (!valid) {
          return createErrorResponse(403, "Invalid or expired link");
        }
      } else {
        const user = await AuthMiddleware(req);
        const member = await getUserOrganizationMember(user.id);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        const { data: proposal } = await supabaseAdmin
          .from("proposals")
          .select("org_id")
          .eq("id", proposalId)
          .maybeSingle();

        if (!proposal || proposal.org_id !== member.org_id) {
          return createErrorResponse(404, "Proposal not found");
        }

        memberId = member.id;
      }

      const result = await acceptProposalCore(proposalId, memberId);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("accept_proposal.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
