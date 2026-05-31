import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type SignProposalContractBody = {
  proposal_id: number;
  public_token: string;
  signatory_name: string;
  confirm_deposit?: boolean;
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
        .select("id, org_id, contract_id, contact_id, status, accepted_at")
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

      const contractUpdate: Record<string, unknown> = {
        status: "signed",
        signed_at: now,
        signed_ip: ip,
        signatory_name: signatoryName,
        signed_by_contact_id: proposal.contact_id,
        updated_at: now,
      };

      const skipBilling =
        Deno.env.get("SKIP_CLIENT_BILLING") === "1" ||
        Deno.env.get("SKIP_CLIENT_BILLING") === "true";

      if (body.confirm_deposit !== false) {
        contractUpdate.deposit_paid_at = now;

        const { data: depositInstallment } = await supabaseAdmin
          .from("proposal_payment_installments")
          .select("id, amount")
          .eq("proposal_id", proposalId)
          .eq("installment_number", 1)
          .maybeSingle();

        if (depositInstallment?.id) {
          await supabaseAdmin
            .from("proposal_payment_installments")
            .update({
              status: "paid",
              paid_at: now,
              payment_method: skipBilling ? "manual" : "manual",
              manual_marked_at: now,
            })
            .eq("id", depositInstallment.id);
        }

        const { data: dealRow } = await supabaseAdmin
          .from("contracts")
          .select("deal_id")
          .eq("id", proposal.contract_id)
          .maybeSingle();

        if (dealRow?.deal_id && depositInstallment?.id) {
          await supabaseAdmin
            .from("deal_client_payments")
            .update({ status: "cleared" })
            .eq("deal_id", dealRow.deal_id)
            .eq(
              "reference_number",
              `proposal-installment-${depositInstallment.id}`,
            );
        }
      }

      await supabaseAdmin
        .from("contracts")
        .update(contractUpdate)
        .eq("id", proposal.contract_id);

      if (proposal.contact_id) {
        await supabaseAdmin
          .from("contacts")
          .update({ status: "client", lead_stage: "won" })
          .eq("id", proposal.contact_id);
      }

      return new Response(
        JSON.stringify({
          contract_id: proposal.contract_id,
          signed_at: now,
          deposit_recorded: body.confirm_deposit !== false,
          billing_mode: skipBilling ? "manual_skipped" : "manual",
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
