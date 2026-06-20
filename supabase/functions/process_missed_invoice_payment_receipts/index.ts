import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  isAuthorizedClientBillingCron,
  isStripeMockMode,
  reconcileStuckClientInvoiceFromStripe,
} from "../_shared/clientProposalBilling.ts";
import { notifyInvoicePaymentReceipt } from "../_shared/invoicePaymentEmails.ts";
import { getStripe } from "../_shared/stripeClient.ts";

type Body = {
  invoice_id?: number;
  limit?: number;
};

/**
 * Backfill payment receipt emails and reconcile invoices paid in Stripe but not in Nomi.
 * Auth: x-cron-secret or service role bearer.
 */
Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const body = (await req.json().catch(() => ({}))) as Body;
      const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
      const invoiceIdFilter = Number(body.invoice_id);

      const stripe = isStripeMockMode() ? null : getStripe();
      const reconciled: Array<{
        invoice_id: number;
        payment_intent_id: string;
        applied: boolean;
        paid_in_full?: boolean;
        reason?: string;
      }> = [];

      if (stripe) {
        let reconcileQuery = supabaseAdmin
          .from("client_invoices")
          .select(
            "id, org_id, amount, amount_paid, stripe_payment_intent_id, status",
          )
          .eq("status", "sent")
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (Number.isFinite(invoiceIdFilter)) {
          reconcileQuery = reconcileQuery.eq("id", invoiceIdFilter);
        } else {
          reconcileQuery = reconcileQuery.not(
            "stripe_payment_intent_id",
            "is",
            null,
          );
        }

        const { data: stuckInvoices, error: reconcileError } =
          await reconcileQuery;
        if (reconcileError) {
          throw new Error(reconcileError.message);
        }

        for (const invoice of stuckInvoices ?? []) {
          try {
            const invoiceResults = await reconcileStuckClientInvoiceFromStripe(
              supabaseAdmin,
              stripe,
              invoice,
            );
            reconciled.push(...invoiceResults);
          } catch (reconcileItemError) {
            console.warn(
              "process_missed_invoice_payment_receipts.reconcile_failed",
              invoice.id,
              reconcileItemError,
            );
            reconciled.push({
              invoice_id: invoice.id,
              payment_intent_id: invoice.stripe_payment_intent_id ?? "",
              applied: false,
              reason:
                reconcileItemError instanceof Error
                  ? reconcileItemError.message
                  : "reconcile_failed",
            });
          }
        }
      }

      let query = supabaseAdmin
        .from("client_invoices")
        .select(
          "id, org_id, amount, amount_paid, stripe_payment_intent_id, status",
        )
        .gt("amount_paid", 0)
        .not("stripe_payment_intent_id", "is", null)
        .in("status", ["sent", "paid"])
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (Number.isFinite(invoiceIdFilter)) {
        query = query.eq("id", invoiceIdFilter);
      }

      const { data: invoices, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const results: Array<{
        invoice_id: number;
        payment_intent_id: string;
        sent: boolean;
        reason?: string;
        error?: string;
      }> = [];

      for (const invoice of invoices ?? []) {
        const piId = invoice.stripe_payment_intent_id?.trim();
        if (!piId) continue;

        const referenceKey = `receipt:${piId}`;
        const { data: existing } = await supabaseAdmin
          .from("client_invoice_email_logs")
          .select("id, delivery_status")
          .eq("invoice_id", invoice.id)
          .eq("reference_key", referenceKey)
          .maybeSingle();

        if (existing?.delivery_status === "sent") {
          results.push({
            invoice_id: invoice.id,
            payment_intent_id: piId,
            sent: false,
            reason: "already_sent",
          });
          continue;
        }

        let chargedAmount =
          Math.round((Number(invoice.amount_paid) || 0) * 100) / 100;
        if (stripe) {
          try {
            const intent = await stripe.paymentIntents.retrieve(piId);
            if (intent.status === "succeeded" && intent.amount) {
              chargedAmount = Math.round(intent.amount) / 100;
            }
          } catch (retrieveError) {
            console.warn(
              "process_missed_invoice_payment_receipts.pi_retrieve_failed",
              piId,
              retrieveError,
            );
          }
        }

        const receipt = await notifyInvoicePaymentReceipt(supabaseAdmin, {
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          stripePaymentIntentId: piId,
          chargedAmount,
          forceResend: existing?.delivery_status !== "sent",
        });

        results.push({
          invoice_id: invoice.id,
          payment_intent_id: piId,
          sent: receipt.sent,
          reason: receipt.reason,
          error: receipt.error,
        });
      }

      return new Response(
        JSON.stringify({
          reconciled,
          processed: results.length,
          results,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("process_missed_invoice_payment_receipts.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
