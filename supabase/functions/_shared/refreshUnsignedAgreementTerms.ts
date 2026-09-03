import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  buildSubscriptionContractVariables,
  mergeContractTerms,
} from "./subscriptionContractTerms.ts";
import type { ClientSubscriptionRow } from "./clientSubscriptionStripe.ts";

const contactDisplayName = (row?: {
  first_name?: string | null;
  last_name?: string | null;
} | null) =>
  [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim();

/**
 * While the agreement is unsigned, rebuild terms from the live contract
 * template + current client/company data so renamed contacts are reflected.
 */
export async function refreshUnsignedAgreementTerms(
  supabase: SupabaseClient,
  subscription: ClientSubscriptionRow,
): Promise<string | null> {
  if (subscription.agreement_signed_at) {
    return subscription.agreement_terms_markdown?.trim() || null;
  }
  if ((subscription.enrollment_mode ?? "direct") !== "agreement") {
    return subscription.agreement_terms_markdown?.trim() || null;
  }

  const termsId = subscription.agreement_contract_terms_id;
  let templateBody = "";
  let defaults: Record<string, string> | null = null;
  let termsVersion =
    subscription.agreement_terms_version?.trim() || "1.0";

  if (termsId != null) {
    const { data: terms } = await supabase
      .from("organization_contract_terms")
      .select("body_markdown, default_variables, version")
      .eq("id", termsId)
      .eq("org_id", subscription.org_id)
      .maybeSingle();
    templateBody = String(terms?.body_markdown ?? "").trim();
    defaults =
      (terms?.default_variables as Record<string, string> | null) ?? null;
    if (terms?.version?.trim()) {
      termsVersion = terms.version.trim();
    }
  }

  // Prefer live template; fall back to stored markdown only if it still has
  // placeholders (staff paste) — never keep a stale filled name forever.
  const stored = String(subscription.agreement_terms_markdown ?? "").trim();
  const sourceBody =
    templateBody ||
    (/\{\{\w+\}\}/.test(stored) ? stored : "") ||
    stored;
  if (!sourceBody) return stored || null;

  const [{ data: contact }, { data: company }, { data: creator }] =
    await Promise.all([
      subscription.contact_id
        ? supabase
            .from("contacts")
            .select("first_name, last_name, email_jsonb, phone_jsonb")
            .eq("id", subscription.contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      subscription.company_id
        ? supabase
            .from("companies")
            .select("name, address, city, state_abbr, zipcode")
            .eq("id", subscription.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      subscription.created_by_member_id
        ? supabase
            .from("organization_members")
            .select("first_name, last_name")
            .eq("id", subscription.created_by_member_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const contactName = contactDisplayName(contact);
  const companyName =
    typeof company?.name === "string" ? company.name.trim() : "";
  const clientName = companyName || contactName || "Client";
  const clientRepresentative = contactName || null;
  const providerRepresentative = contactDisplayName(creator) || null;

  const clientCity =
    typeof company?.city === "string" ? company.city.trim() : "";
  const clientState =
    typeof company?.state_abbr === "string" ? company.state_abbr.trim() : "";
  const clientZip =
    typeof company?.zipcode === "string" ? company.zipcode.trim() : "";
  const clientCityStateZip =
    [clientCity, clientState, clientZip].filter(Boolean).join(", ") || null;
  const clientAddress =
    [
      company?.address,
      clientCity,
      clientState,
      clientZip,
    ]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(", ") || "—";

  let clientEmail: string | null = null;
  let clientPhone: string | null = null;
  const emails = Array.isArray(contact?.email_jsonb)
    ? contact.email_jsonb
    : [];
  const phones = Array.isArray(contact?.phone_jsonb)
    ? contact.phone_jsonb
    : [];
  for (const entry of emails) {
    const value = typeof entry?.email === "string" ? entry.email.trim() : "";
    if (value) {
      clientEmail = value;
      break;
    }
  }
  for (const entry of phones) {
    const value = typeof entry?.number === "string" ? entry.number.trim() : "";
    if (value) {
      clientPhone = value;
      break;
    }
  }

  const lineItems = Array.isArray(subscription.line_items)
    ? subscription.line_items
    : [];

  const vars = buildSubscriptionContractVariables({
    clientName,
    clientAddress,
    clientCityStateZip,
    clientEmail,
    clientPhone,
    clientRepresentative,
    providerRepresentative,
    subscriptionDescription: subscription.description ?? null,
    subscriptionName: subscription.name ?? "Subscription",
    subscriptionNumber: subscription.subscription_number ?? null,
    amount: Number(subscription.amount) || 0,
    currency: subscription.currency ?? "USD",
    billingInterval: subscription.billing_interval ?? "monthly",
    lineItems,
    termsVersion,
    defaultVariables: defaults,
  });

  const filled = mergeContractTerms(sourceBody, vars).trim();
  if (!filled) return stored || null;
  if (filled === stored) return filled;

  await supabase
    .from("client_subscriptions")
    .update({
      agreement_terms_markdown: filled,
      agreement_terms_version: termsVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id)
    .eq("org_id", subscription.org_id);

  subscription.agreement_terms_markdown = filled;
  subscription.agreement_terms_version = termsVersion;
  return filled;
}
