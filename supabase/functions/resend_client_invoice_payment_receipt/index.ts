import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { notifyInvoicePaymentReceipt } from "../_shared/invoicePaymentEmails.ts";
import { isStripeMockMode } from "../_shared/clientProposalBilling.ts";
import { getStripe } from "../_shared/stripeClient.ts";

type ResendBody = {
  invoice_id?: number;
  payment_intent_id?: string;
  charged_amount?: number;
  force?: boolean;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot resend payment receipts");
        }

        const body = (await req.json()) as ResendBody;
        const invoiceId = Number(body.invoice_id);
        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select("id, org_id, amount_paid, stripe_payment_intent_id, status")
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice?.id) {
          return createErrorResponse(404, "Invoice not found");
        }

        const paid = Number(invoice.amount_paid) || 0;
        if (paid <= 0) {
          return createErrorResponse(
            400,
            "This invoice has no recorded payments",
          );
        }

        const paymentIntentId =
          String(body.payment_intent_id ?? "").trim() ||
          invoice.stripe_payment_intent_id?.trim() ||
          null;

        if (!paymentIntentId) {
          return createErrorResponse(
            400,
            "No payment intent is linked to this invoice",
          );
        }

        let chargedAmount = Number(body.charged_amount);
        if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
          if (!isStripeMockMode()) {
            const stripe = getStripe();
            const intent =
              await stripe.paymentIntents.retrieve(paymentIntentId);
            chargedAmount = Math.round(intent.amount ?? 0) / 100;
          } else {
            chargedAmount = paid;
          }
        }

        const receipt = await notifyInvoicePaymentReceipt(supabaseAdmin, {
          orgId: invoice.org_id,
          invoiceId: invoice.id,
          stripePaymentIntentId: paymentIntentId,
          chargedAmount,
          forceResend: Boolean(body.force),
        });

        if (!receipt.sent && receipt.reason === "duplicate") {
          return new Response(
            JSON.stringify({
              invoice_id: invoice.id,
              payment_intent_id: paymentIntentId,
              charged_amount: chargedAmount,
              receipt_sent: true,
              already_sent: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!receipt.sent) {
          const message =
            receipt.reason === "no_email"
              ? "No recipient email is on file for this invoice"
              : receipt.reason === "email_not_configured"
                ? "Email is not configured for your organization"
                : receipt.reason === "email_skipped"
                  ? "Email delivery is disabled on the server"
                  : (receipt.error ?? "Could not send payment receipt");

          return createErrorResponse(400, message);
        }

        return new Response(
          JSON.stringify({
            invoice_id: invoice.id,
            payment_intent_id: paymentIntentId,
            charged_amount: chargedAmount,
            receipt_sent: true,
            already_sent: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("resend_client_invoice_payment_receipt.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
