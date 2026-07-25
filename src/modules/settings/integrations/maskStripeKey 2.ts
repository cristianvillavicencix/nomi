/** Mask Stripe keys for display (publishable, secret, webhook). */
export const maskStripeKey = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
};
