import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type GetPublicSubscriptionSetupBody = {
  short_code?: string;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as GetPublicSubscriptionSetupBody;
      const shortCode = String(body.short_code ?? "").trim();
      if (!shortCode) {
        return createErrorResponse(400, "Missing short_code");
      }

      const { data: tokenRow, error: tokenError } = await supabaseAdmin
        .from("public_client_subscription_setup_tokens")
        .select("org_id, subscription_id, checkout_url")
        .eq("short_code", shortCode)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        return createErrorResponse(404, "Invalid or expired link");
      }

      const checkoutUrl = tokenRow.checkout_url?.trim();
      if (!checkoutUrl) {
        return createErrorResponse(410, "This setup link is no longer available");
      }

      const { data: subscription } = await supabaseAdmin
        .from("client_subscriptions")
        .select("name, status, payment_method_last4, subscription_number")
        .eq("id", tokenRow.subscription_id)
        .eq("org_id", tokenRow.org_id)
        .maybeSingle();

      const alreadyActive =
        subscription?.status === "active" ||
        subscription?.status === "trialing" ||
        Boolean(subscription?.payment_method_last4?.trim());

      return new Response(
        JSON.stringify({
          checkout_url: checkoutUrl,
          subscription_name: subscription?.name ?? "Subscription",
          subscription_number: subscription?.subscription_number ?? null,
          status: subscription?.status ?? null,
          already_active: alreadyActive,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("get_public_subscription_setup.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
