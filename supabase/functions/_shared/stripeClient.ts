// Stripe SDK (Edge / Deno)
// @ts-expect-error ESM from esm.sh (Deno)
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";
import {
  resolveOrgStripeSecretKey,
  resolveOrgStripeWebhookSecret,
} from "./organizationStripeSettings.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

const envSecretKey = () => Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const buildStripe = (secret: string) =>
  new Stripe(secret, {
    httpClient: Stripe.createFetchHttpClient(),
  });

/** Org client payments (invoices, proposals). Falls back to STRIPE_SECRET_KEY env. */
export async function getStripeForOrg(orgId: number) {
  const secret = await resolveOrgStripeSecretKey(orgId);
  if (!secret) {
    throw new Error(
      "Stripe is not configured. Add your keys under Settings → Integrations → Stripe.",
    );
  }
  return buildStripe(secret);
}

/** Legacy: platform env secret (seat billing, old paths). */
export const getStripe = () => {
  const s = envSecretKey();
  if (!s) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return buildStripe(s);
};

export const getWebhookSecret = () => {
  const w = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!w) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return w;
};

/** Client payment webhooks — org DB secret first, then env. */
export async function getClientWebhookSecret(orgId?: number | null) {
  const resolved = await resolveOrgStripeWebhookSecret(orgId);
  if (!resolved) {
    throw new Error("STRIPE_CLIENT_WEBHOOK_SECRET is not set");
  }
  return resolved;
}

/** Any Stripe instance works for constructEvent; webhook secret must match the account. */
export async function getStripeForWebhookVerification() {
  try {
    return getStripe();
  } catch {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .not("stripe_secret_key_encrypted", "is", null)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id != null) {
      return getStripeForOrg(data.id);
    }
    throw new Error("Stripe is not configured");
  }
}

export const defaultSeatPriceId = () =>
  (Deno.env.get("STRIPE_SEAT_PRICE_ID") ?? "").trim() ||
  "price_1TQFalPdDeQWOyitqTFDWn8Q";

export const mapStripeStatusToBilling = (status: string) => {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return status;
    default:
      return "none";
  }
};
