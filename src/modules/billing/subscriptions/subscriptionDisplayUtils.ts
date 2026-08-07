import type { ClientSubscription } from "@/modules/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";

export type SubscriptionStatusFilter =
  | "all"
  | "pending_setup"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "expired";

export const SUBSCRIPTION_FILTER_OPTIONS: Array<{
  value: SubscriptionStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "pending_setup", label: "Pending setup" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
];

export const isSubscriptionExpired = (
  subscription: Pick<ClientSubscription, "ends_at" | "status">,
) => {
  if (subscription.status === "canceled") return false;
  const endsAt = subscription.ends_at?.trim();
  if (!endsAt) return false;
  const endMs = Date.parse(endsAt);
  return Number.isFinite(endMs) && endMs < Date.now();
};

export const subscriptionMatchesStatusFilter = (
  row: ClientSubscription,
  statusFilter: SubscriptionStatusFilter,
) => {
  if (statusFilter === "all") return true;
  if (statusFilter === "expired") return isSubscriptionExpired(row);
  return row.status === statusFilter;
};

export const buildSubscriptionListFilter = (
  statusFilter: SubscriptionStatusFilter,
): Record<string, string> => {
  if (statusFilter === "all" || statusFilter === "expired") {
    return {};
  }
  return { "status@eq": statusFilter };
};

export const subscriptionStatusLabel = (
  status?: string | null,
  subscription?: Pick<ClientSubscription, "ends_at" | "status"> | null,
) => {
  if (subscription && isSubscriptionExpired(subscription)) {
    return "Expired";
  }
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

export const subscriptionStatusVariant = (
  status?: string | null,
  subscription?: Pick<ClientSubscription, "ends_at" | "status"> | null,
) => {
  if (subscription && isSubscriptionExpired(subscription)) {
    return "outline" as const;
  }
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
  rows: ClientSubscription[],
): Record<SubscriptionStatusFilter, number> => {
  const counts: Record<SubscriptionStatusFilter, number> = {
    all: 0,
    pending_setup: 0,
    active: 0,
    past_due: 0,
    paused: 0,
    canceled: 0,
    expired: 0,
  };

  for (const row of rows) {
    counts.all += 1;
    if (isSubscriptionExpired(row)) {
      counts.expired += 1;
    }
    const status = row.status as SubscriptionStatusFilter | undefined;
    if (status && status in counts && status !== "all" && status !== "expired") {
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
    row.subscription_number,
    row.reference_number,
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

export const formatSubscriptionNextBillingLabel = (
  subscription: Pick<
    ClientSubscription,
    "status" | "next_billing_at" | "ends_at"
  >,
) => {
  if (subscription.status === "pending_setup") {
    return "Setup pending";
  }
  if (isSubscriptionExpired(subscription)) {
    return "Expired";
  }
  if (subscription.status === "canceled") {
    return "Canceled";
  }
  if (subscription.status === "paused") {
    return "Paused";
  }
  const nextBilling = subscription.next_billing_at?.slice(0, 10);
  if (!nextBilling) {
    return "No billing date";
  }
  return `Next billing · ${formatBillingDate(nextBilling)}`;
};

export const buildSubscriptionSetupSharePath = (shortCode: string) =>
  `/sub/${shortCode.trim()}`;

export const buildSubscriptionSetupShareUrl = (
  origin: string,
  shortCode: string,
) => `${origin.replace(/\/$/, "")}${buildSubscriptionSetupSharePath(shortCode)}`;

export const buildDefaultSubscriptionSetupMessage = (params: {
  orgLabel: string;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
}) => {
  const planLabel = params.amountLabel
    ? `${params.subscriptionName} (${params.amountLabel})`
    : params.subscriptionName;
  const lines = [
    `${params.orgLabel}: Set up your ${planLabel} subscription and save your card for automatic billing:`,
  ];
  if (params.subscriptionNumber?.trim()) {
    lines.push(`Reference: ${params.subscriptionNumber.trim()}`);
  }
  lines.push("", params.shareUrl.trim());
  return lines.join("\n");
};

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
