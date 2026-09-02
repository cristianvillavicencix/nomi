export const BILLING_TYPES = [
  { value: "one_time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
] as const;

export type BillingType = (typeof BILLING_TYPES)[number]["value"];

export const BILLING_INTERVALS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number]["value"];

export const INSTALLMENT_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
] as const;

export type InstallmentFrequency =
  (typeof INSTALLMENT_FREQUENCIES)[number]["value"];

export const INSTALLMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
  { value: "waived", label: "Waived" },
] as const;

export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number]["value"];

export const PROPOSAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
] as const;

export const DEFAULT_VALIDITY_DAYS = 30;
export const DEFAULT_DEPOSIT_PERCENT = 50;
export const DEFAULT_CURRENCY = "USD";

export const DEFAULT_CONTRACT_VARIABLES = {
  client_response_days: "5",
  revision_rounds: "2",
  timeline: "4–6 weeks",
  cancel_notice_days: "30",
  termination_notice_days: "30",
  warranty_days: "30",
  late_days: "5",
  late_fee: "1.5% mensual",
  currency: "USD",
  lbs_signatory: "Latinos Business Support LLC",
} as const;

/** Defaults for the web maintenance & support contract template. */
export const MAINTENANCE_CONTRACT_VARIABLES = {
  provider_name: "Latino Business Support",
  provider_website: "www.lbs.bz",
  provider_address: "Stamford, Connecticut, EE. UU.",
  provider_incorporation_state: "Connecticut",
  provider_ein: "—",
  provider_email: "info@lbs.bz",
  provider_phone: "—",
  provider_signatory_title: "Representante autorizado",
  client_signatory_title: "Representante autorizado",
  client_city_state_zip: "—",
  client_email: "—",
  client_phone: "—",
  initial_term_months: "6",
  billing_day: "1",
  late_suspension_days: "10",
  fee_increase_notice_days: "60",
  cure_period_days: "15",
  liability_cap_months: "3",
  confidentiality_years: "3",
  credential_handoff_days: "5",
  governing_state: "Connecticut",
  jurisdiction_county: "Fairfield",
  jurisdiction_state: "Connecticut",
  included_hours: "2 horas/mes",
  response_time: "24–48 horas hábiles",
  backup_frequency: "Semanal",
  security_updates: "Sí",
  support_channels: "Email / Ticket",
  support_hours: "Lun–Vie 9:00–17:00 ET",
  additional_scope: "—",
} as const;

/**
 * Org-level defaults editable in Settings → Contract templates.
 *
 * - Provider: LBS company block (same for every client)
 * - Policy: term / SLA / billing / legal (template defaults, NOT filled by picking a client)
 * Client company fields are filled automatically when staff selects the contact/company.
 */
export const CONTRACT_PROVIDER_FIELDS = [
  { key: "provider_name", label: "Company name" },
  { key: "provider_website", label: "Website" },
  { key: "provider_address", label: "Address" },
  { key: "provider_incorporation_state", label: "Incorporation state" },
  { key: "provider_ein", label: "EIN / tax ID" },
  { key: "provider_email", label: "Email" },
  { key: "provider_phone", label: "Phone" },
  { key: "provider_signatory_title", label: "Signatory title" },
  { key: "lbs_signatory", label: "Default signatory name" },
] as const;

/** Data-URL or https image for the provider signature block in Aceptación. */
export const CONTRACT_PROVIDER_SIGNATURE_KEY = "provider_signature_image";

/**
 * Shared acceptance / signature block (two columns). Used by general +
 * maintenance templates so layout stays consistent.
 */
export const CONTRACT_ACCEPTANCE_SIGNATURE_HTML = `<div class="contract-signatures">
<div class="contract-signatures-party">
<p class="contract-signatures-heading">Por el Proveedor</p>
<div class="contract-signatures-mark">{{provider_signature_mark}}</div>
<p><strong>{{lbs_signatory}}</strong></p>
<p>{{provider_signatory_title}}</p>
<p>{{provider_name}}</p>
<p>Fecha: {{contract_date}}</p>
</div>
<div class="contract-signatures-party">
<p class="contract-signatures-heading">Por el Cliente</p>
<div class="contract-signatures-mark">{{client_signature_mark}}</div>
<p><strong>{{client_representative}}</strong></p>
<p>{{client_signatory_title}}</p>
<p>{{client_name}}</p>
<p>Fecha: {{signed_at}}</p>
<p>IP: {{signed_ip}}</p>
</div>
</div>`;

export const buildContractSignatureMarks = (params: {
  providerSignatureImage?: string | null;
  clientSignatureImage?: string | null;
}): { provider_signature_mark: string; client_signature_mark: string } => {
  const isSafeImage = (value: string) =>
    value.startsWith("data:image/") ||
    value.startsWith("https://") ||
    value.startsWith("http://");

  const provider = params.providerSignatureImage?.trim() || "";
  const client = params.clientSignatureImage?.trim() || "";

  return {
    provider_signature_mark: isSafeImage(provider)
      ? `<img src="${provider}" alt="Provider signature" class="contract-signature-img" />`
      : `<span class="contract-signature-line" aria-hidden="true"></span>`,
    client_signature_mark: isSafeImage(client)
      ? `<img src="${client}" alt="Client signature" class="contract-signature-img" />`
      : `<span class="contract-signature-line" aria-hidden="true"></span>`,
  };
};

/** Shown as read-only help — filled when staff picks the client in enrollment. */
export const CONTRACT_CLIENT_AUTO_FILL_FIELDS = [
  { key: "client_name", label: "Company / client name" },
  { key: "client_address", label: "Address" },
  { key: "client_city_state_zip", label: "City, state, ZIP" },
  { key: "client_representative", label: "Representative" },
  { key: "client_email", label: "Email" },
  { key: "client_phone", label: "Phone" },
  { key: "subscription_name", label: "Plan / subscription name" },
  { key: "total_amount", label: "Amount & recurring terms" },
  { key: "line_items", label: "Line items" },
  { key: "subscription_number", label: "Contract / subscription number" },
] as const;

export const CONTRACT_POLICY_FIELD_GROUPS = [
  {
    group: "Term & notices",
    fields: [
      { key: "initial_term_months", label: "Initial term (months)" },
      { key: "cancel_notice_days", label: "Non-renewal notice (days)" },
      { key: "termination_notice_days", label: "Termination notice (days)" },
      { key: "client_response_days", label: "Client response time (days)" },
      {
        key: "fee_increase_notice_days",
        label: "Fee increase notice (days)",
      },
      { key: "cure_period_days", label: "Breach cure period (days)" },
      {
        key: "credential_handoff_days",
        label: "Credential handoff (business days)",
      },
      {
        key: "client_signatory_title",
        label: "Client signatory title (default)",
      },
    ],
  },
  {
    group: "Billing policy",
    fields: [
      { key: "billing_day", label: "Billing day of month" },
      { key: "late_days", label: "Late after (days)" },
      { key: "late_fee", label: "Late fee" },
      { key: "late_suspension_days", label: "Suspend after (days late)" },
      { key: "currency", label: "Currency" },
    ],
  },
  {
    group: "Service plan defaults",
    fields: [
      { key: "included_hours", label: "Included hours" },
      { key: "response_time", label: "Response time" },
      { key: "backup_frequency", label: "Backup frequency" },
      { key: "security_updates", label: "Security updates" },
      { key: "support_channels", label: "Support channels" },
      { key: "support_hours", label: "Support hours" },
      { key: "additional_scope", label: "Additional scope" },
    ],
  },
  {
    group: "Proposal defaults",
    fields: [
      { key: "timeline", label: "Project timeline" },
      { key: "revision_rounds", label: "Revision rounds" },
      { key: "warranty_days", label: "Warranty (days)" },
    ],
  },
  {
    group: "Legal",
    fields: [
      { key: "governing_state", label: "Governing state" },
      { key: "jurisdiction_county", label: "Jurisdiction county" },
      { key: "jurisdiction_state", label: "Jurisdiction state" },
      {
        key: "liability_cap_months",
        label: "Liability cap (months of fees)",
      },
      {
        key: "confidentiality_years",
        label: "Confidentiality survival (years)",
      },
    ],
  },
] as const;

export type ClientBillingMode = "manual" | "stripe";

export const CLIENT_BILLING_MODES = [
  { value: "manual", label: "Manual (mark paid in CRM)" },
  { value: "stripe", label: "Stripe (automatic charges)" },
] as const;
