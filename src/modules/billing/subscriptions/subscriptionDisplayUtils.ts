import type { ClientSubscription } from "@/modules/types";

export type SubscriptionStatusFilter =
  | "all"
  | "pending_setup"
  | "active"
  | "past_due"
  | "paused"
  | "canceled";

export const SUBSCRIPTION_FILTER_OPTIONS: Array<{
  value: SubscriptionStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending_setup", label: "Pending setup" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "paused", label: "Paused" },
  { value: "canceled", label: "Canceled" },
];

export const buildSubscriptionListFilter = (
  statusFilter: SubscriptionStatusFilter,
): Record<string, string> => {
  if (statusFilter === "all") {
    return {};
  }
  return { "status@eq": statusFilter };
};

export const subscriptionStatusLabel = (status?: string | null) => {
  switch (status) {
    case "pending_setup":
      return "Pending setup";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "paused":
      return "Paused";
    case "canceled":
      return "Canceled";
    case "trialing":
      return "Trialing";
    default:
      return status ?? "—";
  }
};

export const subscriptionStatusVariant = (status?: string | null) => {
  switch (status) {
    case "active":
    case "trialing":
      return "default" as const;
    case "past_due":
      return "destructive" as const;
    case "paused":
    case "pending_setup":
      return "secondary" as const;
    case "canceled":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

export const countSubscriptionsByStatusFilter = (
  rows: Array<{ status?: string | null }>,
): Record<SubscriptionStatusFilter, number> => {
  const counts: Record<SubscriptionStatusFilter, number> = {
    all: 0,
    pending_setup: 0,
    active: 0,
    past_due: 0,
    paused: 0,
    canceled: 0,
  };

  for (const row of rows) {
    counts.all += 1;
    const status = row.status as SubscriptionStatusFilter | undefined;
    if (status && status in counts && status !== "all") {
      counts[status] += 1;
    }
  }

  return counts;
};

export const subscriptionMatchesSearchQuery = (
  row: ClientSubscription,
  companyName: string | null,
  contactLabel: string | null,
  query: string,
) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.name,
    companyName,
    contactLabel,
    row.payment_method_last4,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
};

export const formatSubscriptionAmountLabel = (
  amount: number,
  currency = "USD",
  interval?: string | null,
) => {
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount) || 0);
  if (interval === "weekly") return `${money}/wk`;
  if (interval === "yearly") return `${money}/yr`;
  return `${money}/mo`;
};

export const buildDefaultSubscriptionSetupMessage = (params: {
  orgLabel: string;
  subscriptionName: string;
  checkoutUrl: string;
}) =>
  `${params.orgLabel}: Set up your ${params.subscriptionName} subscription and save your card for automatic billing:\n\n${params.checkoutUrl}`;

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

/** Approximate label shown on the client's card/bank statement for each debit. */
export const buildSubscriptionBankStatementPreview = (params: {
  orgName: string;
  subscriptionName: string;
}) => {
  const prefix = shortenStripeStatementPrefix(params.orgName);
  const suffix = sanitizeStripeStatementSuffix(params.subscriptionName).toUpperCase();
  return `${prefix}* ${suffix}`;
};
