import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { assertOrgAdministrator } from "../_shared/messagingSettings.ts";
import {
  getStripeClientSettingsPublic,
  upsertStripeClientSettings,
} from "../_shared/organizationStripeSettings.ts";
import { getStripeForOrg } from "../_shared/stripeClient.ts";

type StripeSettingsBody = {
  action?: "get" | "update" | "test";
  client_payments_enabled?: boolean;
  stripe_publishable_key?: string | null;
  stripe_secret_key?: string | null;
  stripe_webhook_secret?: string | null;
};

const publishableKeyRegex = /^pk_(test|live)_[A-Za-z0-9]+$/;
const secretKeyRegex = /^sk_(test|live)_[A-Za-z0-9]+$/;
const webhookSecretRegex = /^whsec_[A-Za-z0-9]+$/;

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as StripeSettingsBody;
        const action = body.action ?? "get";

        if (action === "get") {
          const status = await getStripeClientSettingsPublic(orgId);
          return new Response(JSON.stringify(status), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await assertOrgAdministrator(user, orgId);

        if (action === "test") {
          const stripe = await getStripeForOrg(orgId);
          await stripe.balance.retrieve();
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action !== "update") {
          return createErrorResponse(400, "Invalid action");
        }

        const publishable = body.stripe_publishable_key?.trim() ?? "";
        if (publishable && !publishableKeyRegex.test(publishable)) {
          return createErrorResponse(400, "Enter a valid Stripe publishable key (pk_…)");
        }

        const secret = body.stripe_secret_key?.trim() ?? "";
        if (secret && !secretKeyRegex.test(secret)) {
          return createErrorResponse(400, "Enter a valid Stripe secret key (sk_…)");
        }

        const webhook = body.stripe_webhook_secret?.trim() ?? "";
        if (webhook && !webhookSecretRegex.test(webhook)) {
          return createErrorResponse(
            400,
            "Enter a valid webhook signing secret (whsec_…)",
          );
        }

        const saved = await upsertStripeClientSettings(orgId, {
          ...(body.client_payments_enabled !== undefined
            ? { client_payments_enabled: body.client_payments_enabled }
            : {}),
          ...(body.stripe_publishable_key !== undefined
            ? { stripe_publishable_key: publishable || null }
            : {}),
          ...(secret ? { stripe_secret_key: secret } : {}),
          ...(webhook ? { stripe_webhook_secret: webhook } : {}),
        });

        return new Response(JSON.stringify(saved), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
