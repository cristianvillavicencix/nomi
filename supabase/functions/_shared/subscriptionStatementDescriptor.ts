const STRIPE_SUFFIX_MAX = 22;
const STRIPE_PREFIX_MAX = 10;

export const sanitizeStripeStatementSuffix = (value: string) => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, STRIPE_SUFFIX_MAX);
  return /[a-zA-Z]/.test(cleaned) ? cleaned : "Subscription";
};

export const shortenStripeStatementPrefix = (value: string) => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, STRIPE_PREFIX_MAX)
    .trim();
  return cleaned || "PAYMENT";
};

/** Approximate card/bank statement label for recurring subscription charges. */
export const buildSubscriptionBankStatementPreview = (params: {
  orgName: string;
  subscriptionName: string;
}) => {
  const prefix = shortenStripeStatementPrefix(params.orgName);
  const suffix = sanitizeStripeStatementSuffix(params.subscriptionName).toUpperCase();
  return `${prefix}* ${suffix}`;
};

/**
 * Card statement text for subscription prices.
 * Subscriptions reject payment_settings…statement_descriptor_suffix; set it on
 * Product via price_data.product_data.statement_descriptor instead.
 */
export const subscriptionProductStatementDescriptor = (subscriptionName: string) =>
  sanitizeStripeStatementSuffix(subscriptionName);
