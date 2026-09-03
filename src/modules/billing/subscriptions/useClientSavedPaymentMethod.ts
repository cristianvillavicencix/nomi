import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { BillToSelection } from "@/modules/billing/BillToClientSearch";
import type { ClientInvoice, ClientSubscription, Contract } from "@/modules/types";

export type ClientSavedPaymentMethod = {
  brand: string | null;
  last4: string;
  source: "invoice" | "contract" | "subscription";
  updatedAt: string | null;
  stripePaymentMethodId?: string | null;
  stripeCustomerId?: string | null;
};

const hasStripeCard = (row: {
  stripe_payment_method_id?: string | null;
  payment_method_last4?: string | null;
}) =>
  Boolean(row.stripe_payment_method_id?.trim()) &&
  Boolean(row.payment_method_last4?.trim());

const toSavedCard = (
  row: {
    stripe_payment_method_id?: string | null;
    stripe_customer_id?: string | null;
    payment_method_brand?: string | null;
    payment_method_last4?: string | null;
    updated_at?: string | null;
  },
  source: ClientSavedPaymentMethod["source"],
): ClientSavedPaymentMethod => ({
  brand: row.payment_method_brand ?? null,
  last4: row.payment_method_last4!.trim(),
  source,
  updatedAt: row.updated_at ?? null,
  stripePaymentMethodId: row.stripe_payment_method_id?.trim() ?? null,
  stripeCustomerId: row.stripe_customer_id?.trim() ?? null,
});

export const formatSavedCardMask = (last4: string) => `····${last4.trim()}`;

/** Stripe Link often stores brand=link and placeholder last4=0000. */
export const formatPaymentMethodLabel = (
  brand?: string | null,
  last4?: string | null,
) => {
  const rawBrand = brand?.trim() || "";
  const digits = last4?.trim() || "";
  const isLink = rawBrand.toLowerCase() === "link";
  const hasRealLast4 = Boolean(digits) && digits !== "0000";
  const prettyBrand = isLink
    ? "Link"
    : rawBrand
      ? rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1)
      : "Card";

  if (isLink && !hasRealLast4) return "Link";
  if (hasRealLast4) return `${prettyBrand} ${formatSavedCardMask(digits)}`;
  return prettyBrand;
};

export const formatSavedCardLabel = (card: ClientSavedPaymentMethod) =>
  formatPaymentMethodLabel(card.brand, card.last4);

export const savedCardSourceLabel = (source: ClientSavedPaymentMethod["source"]) => {
  if (source === "contract") return "Proposal / deposit";
  if (source === "subscription") return "Subscription";
  return "Invoice or ticket";
};

export const pickLatestSavedPaymentMethod = (
  invoices: ClientInvoice[],
  contracts: Contract[],
  subscriptions: ClientSubscription[] = [],
): ClientSavedPaymentMethod | null => {
  const candidates: ClientSavedPaymentMethod[] = [];

  for (const invoice of invoices) {
    if (!hasStripeCard(invoice)) continue;
    candidates.push(toSavedCard(invoice, "invoice"));
  }

  for (const contract of contracts) {
    if (!hasStripeCard(contract)) continue;
    candidates.push(toSavedCard(contract, "contract"));
  }

  for (const subscription of subscriptions) {
    if (!hasStripeCard(subscription)) continue;
    candidates.push(toSavedCard(subscription, "subscription"));
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return bTime - aTime;
  });

  return candidates[0] ?? null;
};

export const collectUniqueSavedCards = (
  invoices: ClientInvoice[],
  contracts: Contract[],
  subscriptions: ClientSubscription[] = [],
): ClientSavedPaymentMethod[] => {
  const seen = new Set<string>();
  const cards: ClientSavedPaymentMethod[] = [];

  const pushUnique = (card: ClientSavedPaymentMethod) => {
    const key =
      card.stripePaymentMethodId?.trim() ??
      `${(card.brand ?? "card").toLowerCase()}-${card.last4}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(card);
  };

  for (const invoice of invoices) {
    if (!hasStripeCard(invoice)) continue;
    pushUnique(toSavedCard(invoice, "invoice"));
  }
  for (const contract of contracts) {
    if (!hasStripeCard(contract)) continue;
    pushUnique(toSavedCard(contract, "contract"));
  }
  for (const subscription of subscriptions) {
    if (!hasStripeCard(subscription)) continue;
    pushUnique(toSavedCard(subscription, "subscription"));
  }

  cards.sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return bTime - aTime;
  });

  return cards;
};

export const useClientSavedPaymentMethod = (billTo: BillToSelection | null) => {
  const clientFilter = useMemo(() => {
    if (!billTo?.contactId && !billTo?.companyId) return null;
    if (billTo.contactId) {
      return { "contact_id@eq": billTo.contactId };
    }
    return { "company_id@eq": billTo.companyId };
  }, [billTo]);

  const { data: invoices = [], isPending: invoicesPending, refetch: refetchInvoices } =
    useGetList<ClientInvoice>(
      "client_invoices",
      {
        filter: clientFilter ?? {},
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: Boolean(clientFilter) },
    );

  const { data: contracts = [], isPending: contractsPending, refetch: refetchContracts } =
    useGetList<Contract>(
      "contracts",
      {
        filter: clientFilter ?? {},
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: Boolean(clientFilter) },
    );

  const {
    data: subscriptions = [],
    isPending: subscriptionsPending,
    refetch: refetchSubscriptions,
  } = useGetList<ClientSubscription>(
      "client_subscriptions",
      {
        filter: clientFilter ?? {},
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: Boolean(clientFilter) },
    );

  const savedCard = useMemo(
    () => pickLatestSavedPaymentMethod(invoices, contracts, subscriptions),
    [invoices, contracts, subscriptions],
  );

  const allSavedCards = useMemo(
    () => collectUniqueSavedCards(invoices, contracts, subscriptions),
    [invoices, contracts, subscriptions],
  );

  const refetch = async () => {
    await Promise.all([
      refetchInvoices(),
      refetchContracts(),
      refetchSubscriptions(),
    ]);
  };

  return {
    isPending: invoicesPending || contractsPending || subscriptionsPending,
    savedCard,
    allSavedCards,
    refetch,
  };
};
