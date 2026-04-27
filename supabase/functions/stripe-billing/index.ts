import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/** Secrets: STRIPE_SECRET_KEY, STRIPE_SEAT_PRICE_ID (optional; defaults in code), BILLING_PUBLIC_SITE_URL (site origin for Checkout/Portal return URLs, e.g. https://app.example.com). */
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  assertPlatformOrOrgAdmin,
  getPrimaryAdminEmail,
  getActiveMemberCount,
} from "../_shared/billingAccess.ts";
import { defaultSeatPriceId, getStripe } from "../_shared/stripeClient.ts";
import { pushSeatCountToStripeForOrg } from "../_shared/syncSubscriptionSeats.ts";

const siteBaseUrl = () =>
  (Deno.env.get("BILLING_PUBLIC_SITE_URL") ?? "").replace(/\/$/, "") || "http://localhost:5173";

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }
    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }
      let body: { action: string; org_id: number; return_path?: string };
      try {
        body = await req.json();
      } catch {
        return createErrorResponse(400, "Invalid JSON");
      }
      if (!body?.action || body.org_id == null) {
        return createErrorResponse(400, "action and org_id are required");
      }
      const orgId = Number(body.org_id);
      if (!Number.isFinite(orgId)) {
        return createErrorResponse(400, "Invalid org_id");
      }

      try {
        await assertPlatformOrOrgAdmin(user, orgId);
      } catch {
        return createErrorResponse(403, "Not authorized to manage this organization");
      }

      const base = siteBaseUrl();
      const returnPath = typeof body.return_path === "string" && body.return_path.startsWith("/")
        ? body.return_path
        : "/sas";
      const checkoutQuerySep = returnPath.includes("?") ? "&" : "?";

      try {
        switch (body.action) {
          case "create_checkout": {
            let stripe: ReturnType<typeof getStripe>;
            try {
              stripe = getStripe();
            } catch (e) {
              return createErrorResponse(500, (e as Error).message);
            }
            const { data: org, error: orgErr } = await supabaseAdmin
              .from("organizations")
              .select("id, stripe_customer_id, billing_status, stripe_seat_price_id, stripe_subscription_id")
              .eq("id", orgId)
              .single();
            if (orgErr || !org) {
              return createErrorResponse(404, "Organization not found");
            }
            const block = org.stripe_subscription_id &&
              ["active", "trialing", "past_due", "incomplete", "unpaid", "paused"].includes(
                org.billing_status ?? "",
              );
            if (block) {
              return createErrorResponse(
                400,
                "This workspace already has a subscription. Open the billing portal to manage it.",
              );
            }
            const price = (org.stripe_seat_price_id?.trim() || defaultSeatPriceId());
            if (!price) {
              return createErrorResponse(500, "Missing STRIPE_SEAT_PRICE_ID / stripe_seat_price_id");
            }
            const seatCount = Math.max(1, await getActiveMemberCount(orgId));
            const adminEmail = await getPrimaryAdminEmail(orgId);
            const session = await stripe.checkout.sessions.create({
              mode: "subscription",
              success_url: `${base}${returnPath}${checkoutQuerySep}checkout=success&org_id=${orgId}`,
              cancel_url: `${base}${returnPath}${checkoutQuerySep}checkout=cancel`,
              client_reference_id: String(orgId),
              line_items: [{ price, quantity: seatCount }],
              ...(org.stripe_customer_id
                ? { customer: org.stripe_customer_id }
                : adminEmail
                ? { customer_email: adminEmail }
                : {}),
              metadata: { org_id: String(orgId) },
              subscription_data: { metadata: { org_id: String(orgId) } },
            });
            if (!session.url) {
              return createErrorResponse(500, "Stripe did not return a session URL");
            }
            return new Response(JSON.stringify({ url: session.url, id: session.id }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          case "billing_portal": {
            let stripe: ReturnType<typeof getStripe>;
            try {
              stripe = getStripe();
            } catch (e) {
              return createErrorResponse(500, (e as Error).message);
            }
            const { data: org, error: oerr } = await supabaseAdmin
              .from("organizations")
              .select("stripe_customer_id")
              .eq("id", orgId)
              .single();
            if (oerr || !org?.stripe_customer_id) {
              return createErrorResponse(400, "No Stripe customer for this organization yet");
            }
            const session = await stripe.billingPortal.sessions.create({
              customer: org.stripe_customer_id,
              return_url: `${base}${returnPath}`,
            });
            return new Response(JSON.stringify({ url: session.url }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          case "sync_seats": {
            const result = await pushSeatCountToStripeForOrg(orgId);
            if (!result.ok) {
              return createErrorResponse(400, result.error);
            }
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
          case "add_one_seat": {
            let stripe: ReturnType<typeof getStripe>;
            try {
              stripe = getStripe();
            } catch (e) {
              return createErrorResponse(500, (e as Error).message);
            }
            const { data: org, error: oerr } = await supabaseAdmin
              .from("organizations")
              .select("id, stripe_subscription_id, billing_status")
              .eq("id", orgId)
              .single();
            if (oerr || !org?.stripe_subscription_id) {
              return createErrorResponse(
                400,
                "You need an active subscription first. Use Subscribe in this screen.",
              );
            }
            const canChange = new Set(["active", "trialing", "past_due"]);
            if (!canChange.has((org.billing_status ?? "").trim())) {
              return createErrorResponse(
                400,
                "Your subscription is not in a state that allows adding seats from here. Use Manage billing, or try again when the subscription is active.",
              );
            }
            const sub = await stripe.subscriptions.retrieve(
              org.stripe_subscription_id,
              { expand: ["items.data"] },
            );
            const first = sub.items.data[0];
            if (!first?.id) {
              return createErrorResponse(500, "Subscription has no line items to update");
            }
            const current = typeof first.quantity === "number" && first.quantity > 0
              ? first.quantity
              : 1;
            const nextQty = current + 1;
            const updated = await stripe.subscriptions.update(sub.id, {
              items: [{ id: first.id, quantity: nextQty }],
              proration_behavior: "create_prorations",
            });
            const qty = updated.items.data[0]?.quantity ?? nextQty;
            await supabaseAdmin
              .from("organizations")
              .update({ billable_seat_count: qty })
              .eq("id", orgId);
            return new Response(
              JSON.stringify({ ok: true as const, quantity: qty, previous: current }),
              {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }
          default:
            return createErrorResponse(400, "Unknown action");
        }
      } catch (e) {
        return createErrorResponse(500, (e as Error).message);
      }
    });
  })
);
