import type { SubscriptionPaymentMode } from "@/modules/billing/subscriptions/subscriptionScheduleUtils";

export type BillingTabId = "invoices" | "subscriptions";

export type { SubscriptionPaymentMode };

export type SubscriptionSubview = "overview" | "invoices" | "cards" | "edit";

export type SubscriptionDetailTab = Exclude<SubscriptionSubview, "edit">;

export const SUBSCRIPTION_DETAIL_TABS: Array<{
  value: SubscriptionDetailTab;
  label: string;
}> = [
  { value: "overview", label: "Overview" },
  { value: "invoices", label: "Invoice history" },
  { value: "cards", label: "Saved cards" },
];

export const BILLING_TABS: Array<{ id: BillingTabId; label: string }> = [
  { id: "invoices", label: "Invoices" },
  { id: "subscriptions", label: "Subscriptions" },
];

export const resolveBillingTab = (
  params: URLSearchParams,
): BillingTabId => {
  const tab = params.get("tab");
  return tab === "subscriptions" ? "subscriptions" : "invoices";
};

export const resolveSubscriptionSubview = (
  params: URLSearchParams,
): SubscriptionSubview => {
  const subview = params.get("subview");
  if (subview === "invoices" || subview === "edit" || subview === "cards") {
    return subview;
  }
  return "overview";
};

export const resolveSubscriptionPaymentMode = (
  params: URLSearchParams,
): SubscriptionPaymentMode | null => {
  const value = params.get("payment_mode");
  if (value === "saved_card" || value === "staff_card" || value === "request_setup") {
    return value;
  }
  return null;
};

export const buildSubscriptionEditSearchParams = (
  subscriptionId: string,
  options?: {
    paymentMode?: SubscriptionPaymentMode | null;
  },
) => {
  const next = new URLSearchParams();
  next.set("tab", "subscriptions");
  next.set("subscription", subscriptionId);
  next.set("subview", "edit");
  if (options?.paymentMode) {
    next.set("payment_mode", options.paymentMode);
  }
  return next;
};

export const buildSubscriptionDetailSearchParams = (
  subscriptionId: string,
  subview: SubscriptionSubview = "overview",
) => {
  const next = new URLSearchParams();
  next.set("tab", "subscriptions");
  next.set("subscription", subscriptionId);
  if (subview !== "overview") {
    next.set("subview", subview);
  }
  return next;
};

export const buildBillingInvoiceDetailPath = (invoiceId: string) =>
  `/billing?tab=invoices&invoice=${encodeURIComponent(String(invoiceId))}`;

/** Preserve invoice workspace params when switching back to Invoices. */
export const buildBillingTabSearchParams = (
  tab: BillingTabId,
  current: URLSearchParams,
) => {
  const next = new URLSearchParams();
  if (tab === "subscriptions") {
    next.set("tab", "subscriptions");
    const subscriptionId = current.get("subscription");
    if (subscriptionId) next.set("subscription", subscriptionId);
    const subview = current.get("subview");
    if (subview && subview !== "overview") {
      next.set("subview", subview);
    }
    return next;
  }

  const invoiceId = current.get("invoice");
  if (invoiceId) next.set("invoice", invoiceId);
  return next;
};

export const isBillingSubscriptionWorkspace = (
  pathname: string,
  search: string,
) => {
  if (!pathname.startsWith("/billing")) return false;
  const params = new URLSearchParams(search);
  return (
    resolveBillingTab(params) === "subscriptions" &&
    Boolean(params.get("subscription"))
  );
};
