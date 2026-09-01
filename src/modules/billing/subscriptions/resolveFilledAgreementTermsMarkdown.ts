import {
  buildSubscriptionContractVariables,
  fillAgreementTermsMarkdown,
  hasUnmergedContractPlaceholders,
  type SubscriptionContractLine,
} from "@/modules/billing/subscriptions/subscriptionAgreementMerge";
import type { ClientSubscription } from "@/modules/types";

/** Fill leftover {{placeholders}} on stored agreement markdown for display / repair. */
export const resolveFilledAgreementTermsMarkdown = (params: {
  markdown?: string | null;
  subscription: Pick<
    ClientSubscription,
    | "name"
    | "description"
    | "amount"
    | "currency"
    | "billing_interval"
    | "line_items"
    | "subscription_number"
    | "agreement_terms_version"
    | "agreement_signed_at"
    | "agreement_signed_ip"
  >;
  clientName: string;
  clientAddress?: string | null;
  clientRepresentative?: string | null;
  providerRepresentative?: string | null;
}): string => {
  const raw = params.markdown?.trim() ?? "";
  if (!raw || !hasUnmergedContractPlaceholders(raw)) return raw;

  const lines = (
    Array.isArray(params.subscription.line_items)
      ? params.subscription.line_items
      : []
  ) as SubscriptionContractLine[];

  const signedAt = params.subscription.agreement_signed_at?.slice(0, 10) ?? "";
  const vars = buildSubscriptionContractVariables({
    clientName: params.clientName,
    clientAddress: params.clientAddress,
    clientRepresentative: params.clientRepresentative,
    providerRepresentative: params.providerRepresentative,
    subscriptionDescription: params.subscription.description,
    subscriptionName: params.subscription.name || "Subscription",
    subscriptionNumber: params.subscription.subscription_number ?? null,
    amount: Number(params.subscription.amount) || 0,
    currency: params.subscription.currency ?? "USD",
    billingInterval: params.subscription.billing_interval ?? "monthly",
    lineItems: lines,
    termsVersion: params.subscription.agreement_terms_version ?? "1.0",
  });
  if (signedAt) {
    vars.signed_at = signedAt;
    vars.accepted_at = signedAt;
    vars.contract_date = signedAt;
  }
  if (params.subscription.agreement_signed_ip?.trim()) {
    vars.signed_ip = params.subscription.agreement_signed_ip.trim();
  }

  return fillAgreementTermsMarkdown(raw, vars);
};
