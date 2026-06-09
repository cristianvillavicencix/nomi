/** Default Stripe Price for $20 USD / seat / month (prod). Override with VITE_STRIPE_SEAT_PRICE_ID. */
export const DEFAULT_STRIPE_SEAT_PRICE_ID = "price_1TQFalPdDeQWOyitqTFDWn8Q";

export const DEFAULT_SEAT_USD_PER_MONTH = 20;

export const resolveSeatPriceId = () =>
  (import.meta.env.VITE_STRIPE_SEAT_PRICE_ID as string | undefined)?.trim() ||
  DEFAULT_STRIPE_SEAT_PRICE_ID;
