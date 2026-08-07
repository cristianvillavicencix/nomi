export const readEnvStripePublishableKey = () =>
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  null;

export const resolveStripePublishableKey = (
  ...candidates: Array<string | null | undefined>
) => {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
};
