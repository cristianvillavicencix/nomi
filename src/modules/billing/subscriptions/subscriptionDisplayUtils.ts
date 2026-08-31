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

/** Corner ribbon for subscription list cards (same pattern as ticket kanban). */
export type SubscriptionListRibbon = {
  key: string;
  label: string;
  className: string;
};

export const resolveSubscriptionListRibbon = (
  subscription: Pick<
    ClientSubscription,
    "ends_at" | "status" | "enrollment_mode" | "agreement_signed_at"
  >,
): SubscriptionListRibbon => {
  if (isSubscriptionExpired(subscription)) {
    return {
      key: "expired",
      label: "Expired",
      className: "bg-zinc-500 text-white dark:bg-zinc-600",
    };
  }
  if (
    subscription.enrollment_mode === "agreement" &&
    subscription.status === "pending_setup" &&
    !subscription.agreement_signed_at
  ) {
    return {
      key: "agreement_pending",
      label: "Agreement",
      className: "bg-indigo-600 text-white dark:bg-indigo-500",
    };
  }
  switch (subscription.status) {
    case "active":
      return {
        key: "active",
        label: "Active",
        className: "bg-emerald-600 text-white dark:bg-emerald-500",
      };
    case "trialing":
      return {
        key: "trialing",
        label: "Trial",
        className: "bg-sky-600 text-white dark:bg-sky-500",
      };
    case "pending_setup":
      return {
        key: "pending",
        label: "Pending",
        className: "bg-amber-500 text-white dark:bg-amber-600",
      };
    case "past_due":
      return {
        key: "past_due",
        label: "Past due",
        className: "bg-destructive text-destructive-foreground",
      };
    case "paused":
      return {
        key: "paused",
        label: "Paused",
        className: "bg-violet-600 text-white dark:bg-violet-500",
      };
    case "canceled":
      return {
        key: "canceled",
        label: "Canceled",
        className: "bg-zinc-600 text-white dark:bg-zinc-500",
      };
    default:
      return {
        key: "unknown",
        label: subscriptionStatusLabel(subscription.status, subscription),
        className: "bg-muted text-muted-foreground",
      };
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
    | "status"
    | "next_billing_at"
    | "ends_at"
    | "enrollment_mode"
    | "agreement_signed_at"
  >,
) => {
  if (
    subscription.enrollment_mode === "agreement" &&
    subscription.status === "pending_setup" &&
    !subscription.agreement_signed_at
  ) {
    return "Awaiting signature";
  }
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

export const hasSubscriptionSetupLink = (
  subscription: Pick<
    ClientSubscription,
    "setup_share_url" | "setup_checkout_url" | "setup_short_code"
  >,
) =>
  Boolean(
    subscription.setup_share_url?.trim() ||
      subscription.setup_checkout_url?.trim() ||
      subscription.setup_short_code?.trim(),
  );

export const canShowSubscriptionSetupLink = (
  subscription: Pick<
    ClientSubscription,
    | "status"
    | "payment_method_last4"
    | "setup_share_url"
    | "setup_checkout_url"
    | "setup_short_code"
  >,
) => {
  if (!hasSubscriptionSetupLink(subscription)) return false;
  if (subscription.status === "pending_setup") return true;
  if (
    subscription.status === "past_due" &&
    !subscription.payment_method_last4?.trim()
  ) {
    return true;
  }
  return false;
};

export const canSyncSubscriptionFromStripe = (
  subscription: Pick<ClientSubscription, "status" | "stripe_subscription_id">,
) =>
  Boolean(subscription.stripe_subscription_id?.trim()) &&
  (subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due" ||
    subscription.status === "paused");

export const buildSubscriptionSetupSharePath = (shortCode: string) =>
  `/sub/${shortCode.trim()}`;

export const buildSubscriptionAgreementSharePath = (shortCode: string) =>
  `/sub-agree/${shortCode.trim()}`;

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
