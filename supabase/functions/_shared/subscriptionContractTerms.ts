import {
  formatMoney,
  mergeContractTerms,
} from "./proposalFlow.ts";

export { mergeContractTerms };

export type SubscriptionContractLine = {
  description?: string;
  quantity?: number;
  unit_price?: number;
  package_id?: number | null;
  addon_id?: number | null;
};

export const buildSubscriptionLineItemsText = (
  lines: SubscriptionContractLine[],
  currency = "USD",
) =>
  lines
    .map((line) => {
      const qty = line.quantity ?? 1;
      const price = line.unit_price ?? 0;
      const total = Math.round(qty * price * 100) / 100;
      const description = String(line.description ?? "Item").trim() || "Item";
      return `- ${description}: ${formatMoney(total, currency)}`;
    })
    .join("\n");

export const buildSubscriptionContractVariables = (params: {
  clientName: string;
  clientAddress?: string | null;
  clientRepresentative?: string | null;
  providerRepresentative?: string | null;
  subscriptionDescription?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amount: number;
  currency?: string;
  billingInterval: string;
  lineItems: SubscriptionContractLine[];
  termsVersion: string;
  defaultVariables?: Record<string, string> | null;
}): Record<string, string> => {
  const currency = (params.currency ?? "USD").toUpperCase();
  const interval = params.billingInterval || "monthly";
  const number = params.subscriptionNumber?.trim() || "";
  const defaults = params.defaultVariables ?? {};
  const company = params.clientName.trim() || "Client";
  const representative = params.clientRepresentative?.trim() || "";
  const providerRep =
    params.providerRepresentative?.trim() || "Latinos Business Support LLC";
  const description = params.subscriptionDescription?.trim() || "";

  return {
    ...defaults,
    client_name: company,
    client_company: company,
    client_representative: representative || "—",
    client_address: params.clientAddress?.trim() || "—",
    provider_representative: providerRep,
    contract_date: new Date().toISOString().slice(0, 10),
    proposal_number: number || params.subscriptionName,
    accepted_at: new Date().toISOString().slice(0, 10),
    signed_at: "",
    signed_ip: "",
    lbs_signatory: providerRep,
    line_items: buildSubscriptionLineItemsText(params.lineItems, currency),
    total_amount: formatMoney(params.amount, currency),
    deposit_amount: formatMoney(0, currency),
    balance_amount: formatMoney(params.amount, currency),
    currency,
    payment_schedule: `Recurring ${interval} billing`,
    recurring_terms: `${formatMoney(params.amount, currency)} / ${interval}`,
    billing_interval: interval,
    subscription_name: params.subscriptionName.trim() || "Subscription",
    subscription_description: description || "—",
    subscription_description_line: description
      ? `Descripción: **${description}**.\n`
      : "",
    subscription_number: number,
    subscription_number_line: number ? ` (${number})` : "",
    proposal_validity_days: "30",
    terms_version: params.termsVersion,
    timeline: "Ongoing while the subscription is active",
    revision_rounds: String(defaults.revision_rounds ?? "2"),
    client_response_days: String(defaults.client_response_days ?? "5"),
    cancel_notice_days: String(defaults.cancel_notice_days ?? "30"),
    late_days: String(defaults.late_days ?? "15"),
    late_fee: String(defaults.late_fee ?? "1.5% monthly"),
    warranty_days: String(defaults.warranty_days ?? "30"),
    termination_notice_days: String(defaults.termination_notice_days ?? "30"),
  };
};

export type ContractTermsRow = {
  id: number;
  version: string;
  title: string;
  body_markdown: string;
  default_variables?: Record<string, string> | null;
  is_default?: boolean;
  is_active?: boolean;
  slug?: string | null;
};

/** Prefer explicit id, then first package default, then org default, then any active. */
export const pickContractTermsForSubscription = (params: {
  requestedId?: number | null;
  lineItems: SubscriptionContractLine[];
  packageDefaults: Map<number, number | null | undefined>;
  templates: ContractTermsRow[];
}): ContractTermsRow | null => {
  const byId = new Map(params.templates.map((row) => [Number(row.id), row]));

  if (params.requestedId != null && byId.has(Number(params.requestedId))) {
    return byId.get(Number(params.requestedId)) ?? null;
  }

  for (const line of params.lineItems) {
    const packageId =
      line.package_id != null ? Number(line.package_id) : Number.NaN;
    if (!Number.isFinite(packageId)) continue;
    const termsId = params.packageDefaults.get(packageId);
    if (termsId != null && byId.has(Number(termsId))) {
      return byId.get(Number(termsId)) ?? null;
    }
  }

  const orgDefault = params.templates.find((row) => row.is_default);
  if (orgDefault) return orgDefault;

  return params.templates[0] ?? null;
};
