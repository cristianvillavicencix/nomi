import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedClientBillingCron } from "../_shared/clientProposalBilling.ts";
import {
  resolveNextInvoicePaymentTarget,
  resolveReminderKind,
  sendClientInvoicePaymentReminder,
} from "../_shared/invoicePaymentEmails.ts";

const MAX_BATCH = 50;

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const today = new Date().toISOString().slice(0, 10);

      const { data: invoices, error } = await supabaseAdmin
        .from("client_invoices")
        .select(
          "id, org_id, invoice_number, amount, amount_paid, currency, contact_id, recipient_email, upfront_percent, auto_charge_remainder, save_card_for_future_charges, due_date, issue_date, remainder_schedule, status",
        )
        .in("status", ["sent", "draft"])
        .limit(MAX_BATCH);

      if (error) {
        throw new Error(error.message);
      }

      const results: Array<{
        invoice_id: number;
        sent: boolean;
        skipped?: boolean;
        reason?: string;
        reminder_kind?: string;
      }> = [];

      for (const invoice of invoices ?? []) {
        const total = Number(invoice.amount) || 0;
        const paid = Number(invoice.amount_paid) || 0;
        const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);

        if (balance <= 0.01) {
          results.push({
            invoice_id: invoice.id,
            sent: false,
            skipped: true,
            reason: "paid",
          });
          continue;
        }

        const target = resolveNextInvoicePaymentTarget(invoice, today);
        if (!target) {
          results.push({
            invoice_id: invoice.id,
            sent: false,
            skipped: true,
            reason: "no_target",
          });
          continue;
        }

        const reminderKind = resolveReminderKind(target.daysUntilDue);
        if (!reminderKind) {
          results.push({
            invoice_id: invoice.id,
            sent: false,
            skipped: true,
            reason: "not_due_for_reminder",
          });
          continue;
        }

        const outcome = await sendClientInvoicePaymentReminder(supabaseAdmin, {
          invoice,
          target,
          reminderKind,
        });

        results.push({
          invoice_id: invoice.id,
          sent: outcome.sent,
          skipped: outcome.skipped,
          reason: "reason" in outcome ? outcome.reason : undefined,
          reminder_kind: reminderKind,
        });
      }

      return new Response(
        JSON.stringify({
          processed: results.length,
          sent: results.filter((row) => row.sent).length,
          skipped: results.filter((row) => row.skipped).length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("process_invoice_payment_reminders.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
