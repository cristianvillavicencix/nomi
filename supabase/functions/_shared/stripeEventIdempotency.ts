import { supabaseAdmin } from "./supabaseAdmin.ts";

export type StripeEventClaim = "claimed" | "duplicate";

/** Insert-once guard so Stripe retries do not run the handler twice. */
export const claimStripeEvent = async (
  eventId: string,
  source: "stripe-webhook" | "stripe-client-webhook",
  eventType: string,
): Promise<StripeEventClaim> => {
  const { error } = await supabaseAdmin.from("stripe_processed_events").insert({
    event_id: eventId,
    source,
    event_type: eventType,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  throw error;
};
