import type { ClientSubscription } from "@/modules/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceOrganizationInfo";
import { PRODUCT_MARK_SRC } from "@/lib/branding";

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

/** Stripe uses `trialing` when billing is deferred to a future starts_at. */
export const isScheduledBillingStart = (
  subscription?: Pick<ClientSubscription, "status" | "starts_at"> | null,
) => {
  if (!subscription || subscription.status !== "trialing") return false;
  const startsAt = subscription.starts_at?.trim();
  if (!startsAt) return false;
  const startMs = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(startsAt) ? `${startsAt}T00:00:00` : startsAt,
  );
  return Number.isFinite(startMs) && startMs > Date.now() + 60_000;
};

export const subscriptionStatusLabel = (
  status?: string | null,
  subscription?: Pick<
    ClientSubscription,
    "ends_at" | "status" | "starts_at"
  > | null,
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
      if (isScheduledBillingStart(subscription)) {
        return `Starts ${formatBillingDate(subscription!.starts_at)}`;
      }
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
    | "ends_at"
    | "status"
    | "starts_at"
    | "enrollment_mode"
    | "agreement_signed_at"
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
      if (isScheduledBillingStart(subscription)) {
        return {
          key: "scheduled",
          label: "Scheduled",
          className: "bg-sky-600 text-white dark:bg-sky-500",
        };
      }
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

const PUBLIC_SUBSCRIPTION_LOGO = `https://www.nomicrm.com${PRODUCT_MARK_SRC}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const publicOrgLabel = (orgLabel: string) =>
  resolveInvoiceOrganizationName({ title: orgLabel });

const flattenSmsBody = (body: string) => body.replace(/\s+/g, " ").trim();

const planLabel = (params: {
  subscriptionName: string;
  amountLabel?: string | null;
}) =>
  params.amountLabel
    ? `${params.subscriptionName} (${params.amountLabel})`
    : params.subscriptionName;

const brandedEmailShell = (params: {
  orgLabel: string;
  greeting: string;
  bodyHtml: string;
  shareUrl: string;
  ctaLabel: string;
  logoUrl?: string | null;
}) => {
  const logo = params.logoUrl?.trim() || PUBLIC_SUBSCRIPTION_LOGO;
  const shareUrl = params.shareUrl.trim();
  return `<div style="font-family:Georgia,'Times New Roman',serif;color:#1f2937;line-height:1.55;max-width:560px;margin:0 auto;">
  <div style="padding:8px 0 20px;">
    <img src="${escapeHtml(logo)}" alt="${escapeHtml(params.orgLabel)}" width="120" height="auto" style="display:block;max-height:48px;width:auto;" />
  </div>
  <p style="margin:0 0 16px;font-size:16px;">${params.greeting}</p>
  ${params.bodyHtml}
  <p style="margin:0 0 28px;">
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">${escapeHtml(params.ctaLabel)}</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;font-family:system-ui,sans-serif;word-break:break-all;">Or open this link: <a href="${escapeHtml(shareUrl)}" style="color:#4b5563;">${escapeHtml(shareUrl)}</a></p>
  <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— ${escapeHtml(params.orgLabel)}</p>
</div>`;
};

export const buildDefaultSubscriptionSetupMessage = (params: {
  orgLabel: string;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
  kind?: "setup" | "card_update";
}) => {
  const org = publicOrgLabel(params.orgLabel);
  const plan = planLabel(params);
  const url = params.shareUrl.trim();
  if (params.kind === "card_update") {
    return flattenSmsBody(`${org}: update your card for ${plan}: ${url}`);
  }
  return flattenSmsBody(
    `${org}: ready to start ${plan}? Add your card for automatic billing: ${url}`,
  );
};

export const buildDefaultSubscriptionSetupSubject = (params: {
  orgLabel: string;
  subscriptionName: string;
  kind?: "setup" | "card_update";
}) => {
  const org = publicOrgLabel(params.orgLabel);
  if (params.kind === "card_update") {
    return `Update your card for ${params.subscriptionName}`;
  }
  return `Start ${params.subscriptionName} with ${org}`;
};

export const buildDefaultSubscriptionSetupEmailHtml = (params: {
  orgLabel: string;
  clientName?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
  kind?: "setup" | "card_update";
  logoUrl?: string | null;
}) => {
  const org = publicOrgLabel(params.orgLabel);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const plan = planLabel(params);
  const intro =
    params.kind === "card_update"
      ? `<p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(org)}</strong> needs an updated card for <strong>${escapeHtml(plan)}</strong>.</p>`
      : `<p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(org)}</strong> is ready for you to start <strong>${escapeHtml(plan)}</strong>.</p>`;
  const next =
    params.kind === "card_update"
      ? `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Update your payment method so billing continues without interruption.</p>`
      : `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Add your card once — billing runs automatically from there.</p>`;
  const ref = params.subscriptionNumber?.trim()
    ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Reference: ${escapeHtml(params.subscriptionNumber.trim())}</p>`
    : "";
  return brandedEmailShell({
    orgLabel: org,
    greeting,
    bodyHtml: `${intro}${ref}${next}`,
    shareUrl: params.shareUrl,
    ctaLabel: params.kind === "card_update" ? "Update card" : "Start subscription",
    logoUrl: params.logoUrl,
  });
};

/** Compact agreement invite SMS / plain preview (single paragraph). */
export const buildDefaultAgreementInviteMessage = (params: {
  orgLabel: string;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
}) => {
  const org = publicOrgLabel(params.orgLabel);
  const plan = planLabel(params);
  const ref = params.subscriptionNumber?.trim()
    ? ` Ref ${params.subscriptionNumber.trim()}.`
    : "";
  return flattenSmsBody(
    `${org}: Please review, sign, and add your card for ${plan}.${ref} ${params.shareUrl.trim()}`,
  );
};

export const buildDefaultAgreementInviteSubject = (subscriptionName: string) =>
  `Please review and sign: ${subscriptionName}`;

export const buildDefaultAgreementInviteEmailHtml = (params: {
  orgLabel: string;
  clientName?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
  logoUrl?: string | null;
}) => {
  const org = publicOrgLabel(params.orgLabel);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const plan = planLabel(params);
  const ref = params.subscriptionNumber?.trim()
    ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Reference: ${escapeHtml(params.subscriptionNumber.trim())}</p>`
    : "";
  return brandedEmailShell({
    orgLabel: org,
    greeting,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(org)}</strong> invited you to review and sign the subscription agreement for <strong>${escapeHtml(plan)}</strong>.</p>${ref}<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">Review the terms, add your signature, then save a payment card. Billing starts automatically after you finish.</p>`,
    shareUrl: params.shareUrl,
    ctaLabel: "Review & sign agreement",
    logoUrl: params.logoUrl,
  });
};

export const wrapSubscriptionMessageInBrandedHtml = (params: {
  orgLabel: string;
  message: string;
  shareUrl: string;
  ctaLabel: string;
  clientName?: string | null;
  logoUrl?: string | null;
}) => {
  const org = publicOrgLabel(params.orgLabel);
  const greeting = params.clientName?.trim()
    ? `Hello ${escapeHtml(params.clientName.trim())},`
    : "Hello,";
  const body = escapeHtml(params.message.trim()).replace(/\n/g, "<br/>");
  return brandedEmailShell({
    orgLabel: org,
    greeting,
    bodyHtml: `<p style="margin:0 0 20px;font-size:15px;color:#4b5563;">${body}</p>`,
    shareUrl: params.shareUrl,
    ctaLabel: params.ctaLabel,
    logoUrl: params.logoUrl,
  });
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
