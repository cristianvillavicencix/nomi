import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  buildClientPaymentMetadata,
  createOffSessionInstallmentPaymentIntent,
  getRecentAttemptCount,
  getStripe,
  handleInstallmentPaymentFailed,
  isAuthorizedClientBillingCron,
  isStripeMockMode,
  logPaymentAttempt,
} from "../_shared/clientProposalBilling.ts";
import { markInstallmentPaidFromStripe } from "../_shared/proposalFlow.ts";

const MAX_BATCH = 50;
const MAX_RETRIES_PER_DAY = 3;

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    if (isStripeMockMode()) {
      return new Response(
        JSON.stringify({
          processed: 0,
          skipped: true,
          reason: "Stripe client billing is disabled",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const stripe = getStripe();

      const { data: dueInstallments, error } = await supabaseAdmin
        .from("proposal_payment_installments")
        .select(
          "id, org_id, proposal_id, amount, due_date, status, installment_number, label",
        )
        .eq("status", "pending")
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(MAX_BATCH);

      if (error) {
        throw new Error(error.message);
      }

      const results: Array<{
        installment_id: number;
        ok: boolean;
        status?: string;
        error?: string;
      }> = [];

      for (const row of dueInstallments ?? []) {
        const { data: proposal } = await supabaseAdmin
          .from("proposals")
          .select(
            "id, contract_id, deal_id, currency, amount, contact_id, org_id",
          )
          .eq("id", row.proposal_id)
          .eq("org_id", row.org_id)
          .maybeSingle();

        if (!proposal) {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "proposal_not_found",
          });
          continue;
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("client_billing_mode")
          .eq("id", proposal.org_id)
          .maybeSingle();

        if (org?.client_billing_mode !== "stripe") {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "org_not_stripe",
          });
          continue;
        }

        if (!proposal.contract_id || !proposal.deal_id) {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "missing_contract_or_deal",
          });
          continue;
        }

        const isDeposit =
          row.installment_number === 1 ||
          row.label?.toLowerCase().includes("deposit");

        if (isDeposit) {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "deposit_not_scheduled",
          });
          continue;
        }

        const recentAttempts = await getRecentAttemptCount(
          supabaseAdmin,
          row.id,
        );
        if (recentAttempts >= MAX_RETRIES_PER_DAY) {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "max_retries",
          });
          continue;
        }

        const { data: contract } = await supabaseAdmin
          .from("contracts")
          .select(
            "id, stripe_customer_id, stripe_payment_method_id, deposit_paid_at",
          )
          .eq("id", proposal.contract_id)
          .maybeSingle();

        if (
          !contract?.stripe_customer_id ||
          !contract?.stripe_payment_method_id ||
          !contract.deposit_paid_at
        ) {
          results.push({
            installment_id: row.id,
            ok: false,
            error: "no_saved_payment_method",
          });
          continue;
        }

        const { data: fresh } = await supabaseAdmin
          .from("proposal_payment_installments")
          .select("status")
          .eq("id", row.id)
          .maybeSingle();

        if (fresh?.status !== "pending") {
          results.push({
            installment_id: row.id,
            ok: true,
            status: "already_processed",
          });
          continue;
        }

        await supabaseAdmin
          .from("proposal_payment_installments")
          .update({
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "pending");

        const currency = (proposal.currency ?? "USD").toLowerCase();
        const amountCents = amountToCents(row.amount ?? 0);
        const metadata = buildClientPaymentMetadata({
          type: "scheduled_installment",
          orgId: row.org_id,
          proposalId: proposal.id,
          contractId: proposal.contract_id,
          installmentId: row.id,
          dealId: proposal.deal_id,
        });

        try {
          const paymentIntent = await createOffSessionInstallmentPaymentIntent(
            stripe,
            {
              amountCents,
              currency,
              customerId: contract.stripe_customer_id,
              paymentMethodId: contract.stripe_payment_method_id,
              metadata,
              idempotencyKey: `installment-${row.id}-${today}`,
            },
          );

          if (paymentIntent.status === "requires_action") {
            await handleInstallmentPaymentFailed(supabaseAdmin, {
              orgId: row.org_id,
              contractId: proposal.contract_id,
              installmentId: row.id,
              stripePaymentIntentId: paymentIntent.id,
              amountCents,
              errorCode: "authentication_required",
              errorMessage: "Customer authentication required",
              requiresAction: true,
            });
            results.push({
              installment_id: row.id,
              ok: false,
              status: "requires_action",
            });
            continue;
          }

          if (paymentIntent.status !== "succeeded") {
            await handleInstallmentPaymentFailed(supabaseAdmin, {
              orgId: row.org_id,
              contractId: proposal.contract_id,
              installmentId: row.id,
              stripePaymentIntentId: paymentIntent.id,
              amountCents,
              errorCode: paymentIntent.status,
              errorMessage: `Unexpected status: ${paymentIntent.status}`,
            });
            results.push({
              installment_id: row.id,
              ok: false,
              status: paymentIntent.status,
            });
            continue;
          }

          await logPaymentAttempt(supabaseAdmin, {
            orgId: row.org_id,
            contractId: proposal.contract_id,
            installmentId: row.id,
            stripePaymentIntentId: paymentIntent.id,
            amountCents,
            status: "succeeded",
            retryCount: recentAttempts,
          });

          await markInstallmentPaidFromStripe(supabaseAdmin, {
            orgId: row.org_id,
            proposalId: proposal.id,
            contractId: proposal.contract_id,
            dealId: proposal.deal_id,
            installmentId: row.id,
            stripePaymentIntentId: paymentIntent.id,
          });

          results.push({
            installment_id: row.id,
            ok: true,
            status: "succeeded",
          });
        } catch (chargeError) {
          const message =
            chargeError instanceof Error
              ? chargeError.message
              : "Charge failed";

          await handleInstallmentPaymentFailed(supabaseAdmin, {
            orgId: row.org_id,
            contractId: proposal.contract_id,
            installmentId: row.id,
            stripePaymentIntentId: null,
            amountCents,
            errorMessage: message,
          });

          await supabaseAdmin
            .from("proposal_payment_installments")
            .update({ status: "pending", updated_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "processing");

          results.push({
            installment_id: row.id,
            ok: false,
            error: message,
          });
        }
      }

      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok).length;

      return new Response(
        JSON.stringify({
          processed: results.length,
          succeeded,
          failed,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("process_scheduled_payments.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
