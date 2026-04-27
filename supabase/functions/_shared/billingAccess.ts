import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";
import { getStripe } from "./stripeClient.ts";

export async function isPlatformOperator(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function countSalesForOrg(orgId: number) {
  const { count, error } = await supabaseAdmin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Licensed seats match users who are not disabled (aligned with per-seat billing).
 */
export async function getActiveMemberCount(orgId: number) {
  const { count, error } = await supabaseAdmin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .or("disabled.is.null,disabled.eq.false");
  if (error) {
    console.error("getActiveMemberCount", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * User may act if they are a platform operator, or the org administrator for `orgId`.
 */
export async function assertPlatformOrOrgAdmin(user: User, orgId: number) {
  if (await isPlatformOperator(user.id)) {
    return;
  }
  const member = await getUserOrganizationMember(user);
  const sOrg = member?.org_id != null ? Number(member.org_id) : null;
  if (member?.administrator === true && sOrg === orgId) {
    return;
  }
  throw new Error("Not authorized to manage billing for this organization");
}

const BILLING_ALLOWS_SEATS = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);

/**
 * Blocks inviting a user when there is no paid plan or when licensed seats (Stripe quantity)
 * are all in use. Skipped if STRIPE_SECRET_KEY is not set (local dev without billing).
 */
export async function assertSeatsAllowNewInvite(orgId: number) {
  if (!Deno.env.get("STRIPE_SECRET_KEY")) {
    return;
  }
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("stripe_subscription_id, billing_status, billable_seat_count")
    .eq("id", orgId)
    .single();
  if (error || !org) {
    throw new Error("Organization not found");
  }
  const status = (org.billing_status ?? "none").trim();
  if (!org.stripe_subscription_id || !BILLING_ALLOWS_SEATS.has(status)) {
    throw new Error(
      "SUBSCRIBE_FIRST: Add a plan in Settings → Plan before inviting more team members.",
    );
  }
  const active = await getActiveMemberCount(orgId);
  let limit = org.billable_seat_count;
  if (limit == null || limit < 1) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
        expand: ["items.data"],
      });
      const q = sub.items.data[0]?.quantity;
      limit = typeof q === "number" && q > 0 ? q : 1;
      await supabaseAdmin
        .from("organizations")
        .update({ billable_seat_count: limit })
        .eq("id", orgId);
    } catch (e) {
      console.error("assertSeatsAllowNewInvite stripe", e);
      throw new Error(
        "Could not verify subscription seats. Try again or open Settings → Plan.",
      );
    }
  }
  if (active >= (limit as number)) {
    throw new Error(
      "SEAT_LIMIT: All purchased seats are in use. Add a seat in Settings → Plan (billing) before inviting another user.",
    );
  }
}

export async function getPrimaryAdminEmail(orgId: number): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("email")
    .eq("org_id", orgId)
    .eq("administrator", true)
    .limit(1)
    .maybeSingle();
  if (data?.email && typeof data.email === "string") {
    return data.email.trim() || null;
  }
  const { data: anyUser } = await supabaseAdmin
    .from("organization_members")
    .select("email")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (anyUser?.email && typeof (anyUser as { email: string }).email === "string") {
    return (anyUser as { email: string }).email.trim() || null;
  }
  return null;
}
