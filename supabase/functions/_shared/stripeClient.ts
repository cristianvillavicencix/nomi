// Stripe SDK (Edge / Deno)
// @ts-expect-error ESM from esm.sh (Deno)
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno&no-check";

const secret = () => Deno.env.get("STRIPE_SECRET_KEY") ?? "";

export const getStripe = () => {
  const s = secret();
  if (!s) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(s, {
    httpClient: Stripe.createFetchHttpClient(),
  });
};

export const getWebhookSecret = () => {
  const w = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!w) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return w;
};

export const defaultSeatPriceId = () =>
  (Deno.env.get("STRIPE_SEAT_PRICE_ID") ?? "").trim() || "price_1TQFalPdDeQWOyitqTFDWn8Q";

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
