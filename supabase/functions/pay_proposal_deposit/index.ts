import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  attachPaymentMethodToCustomer,
  buildClientPaymentMetadata,
  createDepositPaymentIntent,
  findDepositInstallment,
  isStripeMockMode,
  resolveContactEmail,
  resolveOrCreateStripeCustomer,
} from "../_shared/clientProposalBilling.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import {
  finalizeProposalIfPaidInFull,
  recordProposalDepositPaid,
} from "../_shared/proposalFlow.ts";

type PayProposalDepositBody = {
  proposal_id: number;
  public_token: string;
  payment_method_id?: string;
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
      const paymentMethodId = String(body.payment_method_id ?? "").trim();

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
          "id, org_id, contract_id, contact_id, deal_id, accepted_at, amount, currency, title",
        )
        .eq("id", proposalId)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (
        !proposal?.accepted_at ||
        !proposal.contract_id ||
        !proposal.deal_id
      ) {
        return createErrorResponse(
          400,
          "Proposal must be accepted and signed before paying the deposit",
        );
      }

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("client_billing_mode")
        .eq("id", proposal.org_id)
        .maybeSingle();

      const { data: contract } = await supabaseAdmin
        .from("contracts")
        .select(
          "id, status, signed_at, deposit_paid_at, stripe_customer_id, contact_id",
        )
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

      const mockMode =
        isStripeMockMode() || org?.client_billing_mode !== "stripe";

      if (mockMode) {
        await recordProposalDepositPaid(
          supabaseAdmin,
          proposalId,
          proposal.contract_id,
          proposal.deal_id,
          { paymentMethod: "mock" },
        );

        const paidInFull = await finalizeProposalIfPaidInFull(
          supabaseAdmin,
          proposalId,
          proposal.deal_id,
          proposal.amount ?? 0,
          proposal.contact_id,
        );

        const now = new Date().toISOString();

        return new Response(
          JSON.stringify({
            deal_id: proposal.deal_id,
            contract_id: proposal.contract_id,
            deposit_paid_at: now,
            already_paid: false,
            billing_mode: "mock",
            paid_in_full: paidInFull,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!paymentMethodId) {
        return createErrorResponse(400, "payment_method_id is required");
      }

      const depositInstallment = await findDepositInstallment(
        supabaseAdmin,
        proposalId,
      );

      if (!depositInstallment?.id) {
        return createErrorResponse(400, "Deposit installment not found");
      }

      if (depositInstallment.status === "paid") {
        return createErrorResponse(400, "Deposit already paid");
      }

      const email = await resolveContactEmail(
        supabaseAdmin,
        proposal.contact_id ?? contract.contact_id,
      );

      if (!email) {
        return createErrorResponse(
          400,
          "Contact email is required for card payments",
        );
      }

      const { data: contact } = proposal.contact_id
        ? await supabaseAdmin
            .from("contacts")
            .select("first_name, last_name")
            .eq("id", proposal.contact_id)
            .maybeSingle()
        : { data: null };

      const contactName = [contact?.first_name, contact?.last_name]
        .filter(Boolean)
        .join(" ");

      const stripe = await getStripeForOrg(proposal.org_id);
      const customer = await resolveOrCreateStripeCustomer(stripe, {
        email,
        name: contactName || undefined,
        contractId: proposal.contract_id,
        orgId: proposal.org_id,
        proposalId,
        existingCustomerId: contract.stripe_customer_id,
      });

      const { brand, last4 } = await attachPaymentMethodToCustomer(
        stripe,
        customer.id,
        paymentMethodId,
      );

      const currency = (proposal.currency ?? "USD").toLowerCase();
      const amountCents = amountToCents(depositInstallment.amount ?? 0);

      const metadata = buildClientPaymentMetadata({
        type: "proposal_deposit",
        orgId: proposal.org_id,
        proposalId,
        contractId: proposal.contract_id,
        installmentId: depositInstallment.id,
        dealId: proposal.deal_id,
      });

      const paymentIntent = await createDepositPaymentIntent(stripe, {
        amountCents,
        currency,
        customerId: customer.id,
        paymentMethodId,
        metadata,
        idempotencyKey: `proposal-deposit-${depositInstallment.id}`,
      });

      if (paymentIntent.status === "requires_action") {
        return new Response(
          JSON.stringify({
            deal_id: proposal.deal_id,
            contract_id: proposal.contract_id,
            billing_mode: "stripe",
            requires_action: true,
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (paymentIntent.status !== "succeeded") {
        return createErrorResponse(
          402,
          `Payment could not be completed (${paymentIntent.status})`,
        );
      }

      await recordProposalDepositPaid(
        supabaseAdmin,
        proposalId,
        proposal.contract_id,
        proposal.deal_id,
        {
          paymentMethod: "stripe",
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId: customer.id,
          stripePaymentMethodId: paymentMethodId,
          paymentMethodBrand: brand,
          paymentMethodLast4: last4,
        },
      );

      const paidInFull = await finalizeProposalIfPaidInFull(
        supabaseAdmin,
        proposalId,
        proposal.deal_id,
        proposal.amount ?? 0,
        proposal.contact_id,
      );

      const now = new Date().toISOString();

      return new Response(
        JSON.stringify({
          deal_id: proposal.deal_id,
          contract_id: proposal.contract_id,
          deposit_paid_at: now,
          already_paid: false,
          billing_mode: "stripe",
          payment_intent_id: paymentIntent.id,
          paid_in_full: paidInFull,
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
