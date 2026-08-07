export type BillingTabId = "invoices" | "subscriptions";

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
