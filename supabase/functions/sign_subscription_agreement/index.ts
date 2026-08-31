import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";
import { resolveClientAppBaseUrl } from "../_shared/publicAppUrl.ts";
import {
  buildSubscriptionMetadata,
  createStripeSubscriptionSetupCheckout,
  type ClientSubscriptionRow,
} from "../_shared/clientSubscriptionStripe.ts";
import { ensureSubscriptionAgreementShareLink } from "../_shared/clientSubscriptionSetupLink.ts";

type SignBody = {
  short_code?: string;
  signatory_name?: string;
  signature_png?: string;
  base_url?: string | null;
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
      const body = (await req.json()) as SignBody;
      const shortCode = String(body.short_code ?? "").trim();
      const signatoryName = String(body.signatory_name ?? "").trim();
      const signaturePng = String(body.signature_png ?? "").trim();

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

      if (!subscription || subscription.enrollment_mode !== "agreement") {
        return createErrorResponse(404, "Subscription not found");
      }

      if (
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        subscription.stripe_subscription_id
      ) {
        return createErrorResponse(409, "This subscription is already active");
      }

      const alreadySigned = Boolean(subscription.agreement_signed_at);
      // Resume after cancel: already signed → skip name/PNG, only open Checkout.
      if (!alreadySigned) {
        if (!signatoryName) {
          return createErrorResponse(400, "Name/initials are required");
        }
        if (!signaturePng.startsWith("data:image/")) {
          return createErrorResponse(
            400,
            "Draw your signature before continuing",
          );
        }
        // Keep payload bounded (base64 PNG from small canvas).
        if (signaturePng.length > 400_000) {
          return createErrorResponse(400, "Signature image is too large");
        }

        const now = new Date().toISOString();
        await supabaseAdmin
          .from("client_subscriptions")
          .update({
            agreement_signed_at: now,
            agreement_signatory_name: signatoryName,
            agreement_signature_png: signaturePng,
            agreement_signed_ip: clientIp(req),
            updated_at: now,
          })
          .eq("id", subscription.id);
      }

      const customerId = subscription.stripe_customer_id?.trim();
      if (!customerId) {
        return createErrorResponse(
          400,
          "Billing customer is not ready. Ask your provider to resend the link.",
        );
      }

      const stripe = await getStripeForOrg(tokenRow.org_id);
      const baseUrl = resolveClientAppBaseUrl(body.base_url);
      const metadata = buildSubscriptionMetadata({
        orgId: tokenRow.org_id,
        subscriptionId: subscription.id,
        contactId: subscription.contact_id,
        companyId: subscription.company_id,
      });

      const session = await createStripeSubscriptionSetupCheckout(stripe, {
        customerId,
        successUrl: `${baseUrl}/sub-agree/${shortCode}?card=success`,
        cancelUrl: `${baseUrl}/sub-agree/${shortCode}?card=cancel`,
        metadata,
      });

      const checkoutUrl = session.url ?? null;
      if (!checkoutUrl) {
        return createErrorResponse(500, "Could not start card setup");
      }

      await supabaseAdmin
        .from("client_subscriptions")
        .update({
          stripe_checkout_session_id: session.id,
          setup_checkout_url: checkoutUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      await ensureSubscriptionAgreementShareLink(supabaseAdmin, {
        orgId: tokenRow.org_id,
        subscriptionId: subscription.id,
        baseUrl,
        checkoutUrl,
      });

      return new Response(
        JSON.stringify({
          checkout_url: checkoutUrl,
          signed: true,
          subscription: subscription as ClientSubscriptionRow,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("sign_subscription_agreement.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
