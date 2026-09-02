import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  buildSubscriptionAgreementDocuments,
  sendSubscriptionAgreementCompletionEmail,
} from "../_shared/subscriptionAgreementCompletion.ts";
import type { ClientSubscriptionRow } from "../_shared/clientSubscriptionStripe.ts";

type Body = {
  short_code?: string;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as Body;
      const shortCode = String(body.short_code ?? "").trim();
      if (!shortCode) {
        return createErrorResponse(400, "Missing link");
      }

      const { data: tokenRow } = await supabaseAdmin
        .from("public_client_subscription_setup_tokens")
        .select("org_id, subscription_id, purpose")
        .eq("short_code", shortCode)
        .eq("purpose", "agreement")
        .maybeSingle();

      if (!tokenRow) {
        return createErrorResponse(403, "Invalid or expired link");
      }

      const { data: subscription } = await supabaseAdmin
        .from("client_subscriptions")
        .select("*")
        .eq("id", tokenRow.subscription_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      if (!subscription) {
        return createErrorResponse(404, "Subscription not found");
      }

      const row = subscription as ClientSubscriptionRow;
      if (!row.agreement_signed_at) {
        return createErrorResponse(400, "Agreement is not signed yet");
      }

      // Best-effort: email PDFs once if webhook has not already.
      let emailSent = false;
      const cardOnFile = Boolean(
        row.stripe_payment_method_id?.trim() ||
          row.payment_method_last4?.trim() ||
          row.stripe_subscription_id?.trim() ||
          row.status === "active",
      );
      if (cardOnFile) {
        try {
          const result = await sendSubscriptionAgreementCompletionEmail(
            supabaseAdmin,
            row,
          );
          emailSent = result.emailed;
        } catch (error) {
          console.error(
            "get_public_subscription_agreement_documents.email",
            error,
          );
        }
      }

      const docs = await buildSubscriptionAgreementDocuments(
        supabaseAdmin,
        row,
      );

      return new Response(
        JSON.stringify({
          contract_pdf_base64: docs.contractPdfBase64,
          contract_filename: docs.contractFilename,
          receipt_pdf_base64: docs.receiptPdfBase64,
          receipt_filename: docs.receiptFilename,
          email_sent: emailSent,
          client_email: docs.clientEmail,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("get_public_subscription_agreement_documents.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Could not build documents",
      );
    }
  }),
);
