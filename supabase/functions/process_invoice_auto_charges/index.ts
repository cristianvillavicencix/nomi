import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  amountToCents,
  createOffSessionInvoicePaymentIntent,
  isAuthorizedClientBillingCron,
  isStripeMockMode,
} from "../_shared/clientProposalBilling.ts";
import { applyClientInvoicePaymentUpdate } from "../_shared/clientInvoicePayment.ts";
import { getStripe } from "../_shared/stripeClient.ts";
import {
  getUnpaidRemainderChargesDueBy,
  parseInvoiceRemainderSchedule,
} from "../_shared/invoiceRemainderSchedule.ts";
import { notifyInvoicePaymentReceipt } from "../_shared/invoicePaymentEmails.ts";

const MAX_BATCH = 25;
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

      const { data: candidates, error } = await supabaseAdmin
        .from("client_invoices")
        .select(
          "id, org_id, amount, amount_paid, currency, status, upfront_percent, auto_charge_remainder, save_card_for_future_charges, stripe_customer_id, stripe_payment_method_id, issue_date, due_date, remainder_schedule",
        )
        .eq("auto_charge_remainder", true)
        .eq("save_card_for_future_charges", true)
        .in("status", ["sent", "draft"])
        .not("stripe_customer_id", "is", null)
        .not("stripe_payment_method_id", "is", null)
        .limit(MAX_BATCH);

      if (error) {
        throw new Error(error.message);
      }

      const results: Array<{
        invoice_id: number;
        ok: boolean;
        status?: string;
        error?: string;
      }> = [];

      for (const invoice of candidates ?? []) {
        const total = Number(invoice.amount) || 0;
        const paid = Number(invoice.amount_paid) || 0;
        const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);

        if (balance <= 0.01) {
          results.push({
            invoice_id: invoice.id,
            ok: true,
            status: "already_paid",
          });
          continue;
        }

        const scheduleConfig = parseInvoiceRemainderSchedule(
          invoice.remainder_schedule,
          invoice.due_date ?? today,
        );
        const dueCharges = getUnpaidRemainderChargesDueBy({
          total,
          upfrontPercent: Number(invoice.upfront_percent ?? 100),
          config: scheduleConfig,
          invoiceDueDate: invoice.due_date ?? today,
          issueDate: invoice.issue_date ?? today,
          asOfDate: today,
        });

        if (!dueCharges.length) {
          results.push({
            invoice_id: invoice.id,
            ok: true,
            status: "nothing_due",
          });
          continue;
        }

        const charge = dueCharges[0];
        const chargeAmount = Math.min(charge.amount, balance);
        if (chargeAmount < 0.01) {
          results.push({
            invoice_id: invoice.id,
            ok: true,
            status: "zero_charge",
          });
          continue;
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentFailures } = await supabaseAdmin
          .from("client_invoice_auto_charge_logs")
          .select("id", { count: "exact", head: true })
          .eq("invoice_id", invoice.id)
          .eq("installment_number", charge.installment_number)
          .eq("status", "failed")
          .gte("attempted_at", since);

        if ((recentFailures ?? 0) >= MAX_RETRIES_PER_DAY) {
          results.push({
            invoice_id: invoice.id,
            ok: false,
            error: "max_retries",
          });
          continue;
        }

        const amountCents = amountToCents(chargeAmount);
        const idempotencyKey = `invoice-auto-${invoice.id}-${charge.installment_number}-${today}`;

        try {
          const paymentIntent = await createOffSessionInvoicePaymentIntent(
            stripe,
            {
              amountCents,
              currency: invoice.currency ?? "usd",
              customerId: invoice.stripe_customer_id!,
              paymentMethodId: invoice.stripe_payment_method_id!,
              idempotencyKey,
              metadata: {
                type: "client_invoice",
                org_id: String(invoice.org_id),
                invoice_id: String(invoice.id),
                remainder_installment_number: String(charge.installment_number),
                auto_charge: "1",
              },
            },
          );

          if (paymentIntent.status === "requires_action") {
            await supabaseAdmin.from("client_invoice_auto_charge_logs").insert({
              org_id: invoice.org_id,
              invoice_id: invoice.id,
              installment_number: charge.installment_number,
              stripe_payment_intent_id: paymentIntent.id,
              amount_cents: amountCents,
              status: "requires_action",
              error_code: "authentication_required",
              error_message: "Customer authentication required",
            });
            await supabaseAdmin
              .from("client_invoices")
              .update({
                last_auto_charge_error:
                  "Card requires authentication — client must pay manually.",
                updated_at: new Date().toISOString(),
              })
              .eq("id", invoice.id);
            results.push({
              invoice_id: invoice.id,
              ok: false,
              status: "requires_action",
            });
            continue;
          }

          if (paymentIntent.status !== "succeeded") {
            throw new Error(
              `Unexpected payment status: ${paymentIntent.status}`,
            );
          }

          await applyClientInvoicePaymentUpdate(supabaseAdmin, {
            invoice,
            chargeAmount,
            stripePaymentIntentId: paymentIntent.id,
            newlyPaidInstallmentNumbers: [charge.installment_number],
            stripeCustomerId: invoice.stripe_customer_id,
            stripePaymentMethodId: invoice.stripe_payment_method_id,
            clearAutoChargeError: true,
          });

          await notifyInvoicePaymentReceipt(supabaseAdmin, {
            orgId: invoice.org_id,
            invoiceId: invoice.id,
            stripePaymentIntentId: paymentIntent.id,
            chargedAmount: chargeAmount,
          });

          await supabaseAdmin.from("client_invoice_auto_charge_logs").insert({
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            installment_number: charge.installment_number,
            stripe_payment_intent_id: paymentIntent.id,
            amount_cents: amountCents,
            status: "succeeded",
          });

          results.push({
            invoice_id: invoice.id,
            ok: true,
            status: "succeeded",
          });
        } catch (chargeError) {
          const message =
            chargeError instanceof Error
              ? chargeError.message
              : "Auto-debit failed";

          await supabaseAdmin.from("client_invoice_auto_charge_logs").insert({
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            installment_number: charge.installment_number,
            amount_cents: amountCents,
            status: "failed",
            error_message: message,
          });

          await supabaseAdmin
            .from("client_invoices")
            .update({
              last_auto_charge_error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

          results.push({
            invoice_id: invoice.id,
            ok: false,
            error: message,
          });
        }
      }

      return new Response(
        JSON.stringify({
          processed: results.length,
          succeeded: results.filter((entry) => entry.ok).length,
          failed: results.filter((entry) => !entry.ok).length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("process_invoice_auto_charges.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
