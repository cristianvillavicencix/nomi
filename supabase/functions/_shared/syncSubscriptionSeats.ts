import { getStripe } from "./stripeClient.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { countSalesForOrg } from "./billingAccess.ts";

/**
 * Pushes the current `sales` row count for the org to the Stripe subscription quantity
 * (per-seat / licensed billing).
 */
export async function pushSeatCountToStripeForOrg(orgId: number) {
  const stripe = getStripe();
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, stripe_subscription_id")
    .eq("id", orgId)
    .single();

  if (error || !org?.stripe_subscription_id) {
    return { ok: false as const, error: "No subscription on file for this organization" };
  }

  const seats = await countSalesForOrg(orgId);
  const quantity = Math.max(1, seats);

  const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
    expand: ["items.data"],
  });
  const first = sub.items.data[0];
  if (!first?.id) {
    return { ok: false as const, error: "Subscription has no line items" };
  }

  if (first.quantity === quantity) {
    return { ok: true as const, quantity, skipped: true };
  }

  await stripe.subscriptions.update(org.stripe_subscription_id, {
    items: [{ id: first.id, quantity }],
    proration_behavior: "create_prorations",
  });
  return { ok: true as const, quantity, skipped: false };
}
