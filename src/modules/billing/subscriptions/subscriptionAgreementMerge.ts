/** Shared {{var}} merge for subscription agreement templates (mirrors proposal dialect). */

import { buildContractSignatureMarks } from "@/modules/proposals/proposalCommercialConstants";

export const mergeSubscriptionContractTerms = (
  body: string,
  variables: Record<string, string>,
) =>
  body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");

export const hasUnmergedContractPlaceholders = (body?: string | null) =>
  /\{\{\w+\}\}/.test(body ?? "");

/** Merge again so leftover {{vars}} (or staff-pasted templates) get filled. */
export const fillAgreementTermsMarkdown = (
  body: string,
  variables: Record<string, string>,
) => mergeSubscriptionContractTerms(body, variables);

export const formatSubscriptionContractMoney = (
  amount: number,
  currency = "USD",
) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );

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
      return `- ${description}: ${formatSubscriptionContractMoney(total, currency)}`;
    })
    .join("\n");

export const resolveDefaultContractTermsIdFromPackages = (params: {
  lineItems: Array<{ package_id?: number | null }>;
  packagesById: Map<number, { default_contract_terms_id?: number | null }>;
  orgDefaultTermsId?: number | null;
  activeTermsIds?: number[];
}): number | null => {
  for (const line of params.lineItems) {
    const packageId = line.package_id != null ? Number(line.package_id) : NaN;
    if (!Number.isFinite(packageId)) continue;
    const pkg = params.packagesById.get(packageId);
    const linked = pkg?.default_contract_terms_id;
    if (linked != null && Number.isFinite(Number(linked))) {
      return Number(linked);
    }
  }
  if (
    params.orgDefaultTermsId != null &&
    Number.isFinite(Number(params.orgDefaultTermsId))
  ) {
    return Number(params.orgDefaultTermsId);
  }
  const firstActive = params.activeTermsIds?.[0];
  return firstActive != null ? Number(firstActive) : null;
};

export const buildSubscriptionContractVariables = (params: {
  clientName: string;
  clientAddress?: string | null;
  /** Contact / signer acting for the client company. */
  clientRepresentative?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCityStateZip?: string | null;
  /** Staff member representing the provider (LBS). */
  providerRepresentative?: string | null;
  /** Optional notes from the subscription record. */
  subscriptionDescription?: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amount: number;
  currency?: string;
  billingInterval: "weekly" | "monthly" | "yearly" | string;
  lineItems: SubscriptionContractLine[];
  termsVersion: string;
  defaultVariables?: Record<string, string> | null;
  clientSignatureImage?: string | null;
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
  const signatureMarks = buildContractSignatureMarks({
    providerSignatureImage: defaults.provider_signature_image,
    clientSignatureImage: params.clientSignatureImage,
  });

  return {
    ...defaults,
    ...signatureMarks,
    provider_name:
      defaults.provider_name?.trim() || "Latinos Business Support LLC",
    provider_signatory_title:
      defaults.provider_signatory_title?.trim() || "Authorized representative",
    client_signatory_title:
      defaults.client_signatory_title?.trim() || "Authorized representative",
    client_name: company,
    client_company: company,
    client_representative: representative || "—",
    client_address: params.clientAddress?.trim() || "—",
    client_city_state_zip:
      params.clientCityStateZip?.trim() ||
      defaults.client_city_state_zip ||
      "—",
    client_email: params.clientEmail?.trim() || defaults.client_email || "—",
    client_phone: params.clientPhone?.trim() || defaults.client_phone || "—",
    provider_representative: providerRep,
    contract_date: new Date().toISOString().slice(0, 10),
    proposal_number: number || params.subscriptionName,
    accepted_at: new Date().toISOString().slice(0, 10),
    signed_at: "",
    signed_ip: "",
    // Prefer template default (Contracts → Configure); fall back to staff name.
    lbs_signatory: defaults.lbs_signatory?.trim() || providerRep,
    line_items: buildSubscriptionLineItemsText(params.lineItems, currency),
    total_amount: formatSubscriptionContractMoney(params.amount, currency),
    deposit_amount: formatSubscriptionContractMoney(0, currency),
    balance_amount: formatSubscriptionContractMoney(params.amount, currency),
    currency,
    payment_schedule: `Recurring ${interval} billing`,
    recurring_terms: `${formatSubscriptionContractMoney(params.amount, currency)} / ${interval}`,
    billing_interval: interval,
    subscription_name: params.subscriptionName.trim() || "Subscription",
    subscription_description: description || "—",
    subscription_description_line: description
      ? `Descripción: **${description}**.\n`
      : "",
    subscription_number: number || "Se asignará al enviar",
    subscription_number_line: number ? ` (${number})` : "",
    proposal_validity_days: "30",
    terms_version: params.termsVersion,
    timeline: "Ongoing while the subscription is active",
    revision_rounds: defaults.revision_rounds ?? "2",
    client_response_days: defaults.client_response_days ?? "5",
    cancel_notice_days: defaults.cancel_notice_days ?? "30",
    late_days: defaults.late_days ?? "15",
    late_fee: defaults.late_fee ?? "1.5% monthly",
    warranty_days: defaults.warranty_days ?? "30",
    termination_notice_days: defaults.termination_notice_days ?? "30",
  };
};

export { applyLiveClientSignatureFields } from "./applyLiveClientSignatureFields";

