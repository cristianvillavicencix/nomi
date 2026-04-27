import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/** Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Register endpoint in Stripe Dashboard → Developers → Webhooks. */
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getStripe,
  getWebhookSecret,
  mapStripeStatusToBilling,
} from "../_shared/stripeClient.ts";
import { pushSeatCountToStripeForOrg } from "../_shared/syncSubscriptionSeats.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { corsHeaders } from "../_shared/cors.ts";

const resolveOrgIdFromSubscription = async (
  sub: { id: string; customer: string; metadata: Record<string, string> | null | undefined },
) => {
  const raw = sub.metadata?.org_id;
  if (raw) {
    const n = Number.parseInt(String(raw), 10);
    if (Number.isFinite(n)) return n;
  }
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", sub.customer)
    .maybeSingle();
  return data?.id != null ? Number(data.id) : null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  let stripe: ReturnType<typeof getStripe>;
  let wh: string;
  try {
    stripe = getStripe();
    wh = getWebhookSecret();
  } catch (e) {
    return createErrorResponse(500, (e as Error).message);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return createErrorResponse(400, "Missing stripe-signature");
  }

  const body = await req.text();

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      wh,
    ) as typeof event;
  } catch (e) {
    return createErrorResponse(400, (e as Error).message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          mode?: string;
          client_reference_id?: string | null;
          metadata?: Record<string, string> | null;
          customer?: string | null;
          subscription?: string | null;
        };
        if (session.mode !== "subscription" || !session.subscription) {
          break;
        }
        const orgIdRaw = session.client_reference_id ??
          session.metadata?.org_id;
        if (!orgIdRaw) {
          console.error("checkout.session.completed without org id");
          break;
        }
        const orgId = Number.parseInt(String(orgIdRaw), 10);
        if (!Number.isFinite(orgId)) break;

        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] },
        );

        const status = mapStripeStatusToBilling(sub.status);
        const customer = typeof session.customer === "string"
          ? session.customer
          : String(session.customer);

        const { error } = await supabaseAdmin
          .from("organizations")
          .update({
            stripe_customer_id: customer,
            stripe_subscription_id: sub.id,
            billing_status: status,
            stripe_seat_price_id:
              (sub.items.data[0]?.price as { id?: string } | null)?.id ?? null,
          })
          .eq("id", orgId);
        if (error) {
          console.error("Failed to update org from checkout", error);
        } else {
          try {
            await pushSeatCountToStripeForOrg(orgId);
          } catch (e) {
            console.error("post-checkout seat sync", e);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subPartial = event.data.object as {
          id: string;
          status: string;
          customer: string;
          metadata?: Record<string, string> | null;
        };
        const orgId = await resolveOrgIdFromSubscription(subPartial);
        if (orgId == null) {
          break;
        }
        let billableCount: number | null = null;
        try {
          const stripe = getStripe();
          const full = await stripe.subscriptions.retrieve(subPartial.id, {
            expand: ["items.data"],
          });
          const q = full.items.data[0]?.quantity;
          billableCount = typeof q === "number" ? q : null;
        } catch (e) {
          console.error("subscription webhook retrieve", e);
        }
        const status = mapStripeStatusToBilling(subPartial.status);
        await supabaseAdmin
          .from("organizations")
          .update({
            stripe_customer_id: subPartial.customer,
            stripe_subscription_id: subPartial.id,
            billing_status: status,
            ...(billableCount != null ? { billable_seat_count: billableCount } : {}),
          })
          .eq("id", orgId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as {
          id: string;
          customer: string;
          metadata?: Record<string, string> | null;
        };
        let targetOrgId: number | null = await resolveOrgIdFromSubscription(sub);
        if (targetOrgId == null) {
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();
          targetOrgId = org?.id != null ? Number(org.id) : null;
        }
        if (targetOrgId == null) break;
        await supabaseAdmin
          .from("organizations")
          .update({
            billing_status: "canceled",
            stripe_subscription_id: null,
            billable_seat_count: null,
          })
          .eq("id", targetOrgId);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as { customer?: string | null; subscription?: string | null };
        const subId = inv.subscription;
        if (!subId || typeof subId !== "string") break;
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", subId)
          .maybeSingle();
        if (org?.id == null) break;
        await supabaseAdmin
          .from("organizations")
          .update({ billing_status: "past_due" })
          .eq("id", org.id);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("stripe-webhook handler", e);
    return createErrorResponse(500, (e as Error).message);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
