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

export type ClientBillingMode = "manual" | "stripe";

export const CLIENT_BILLING_MODES = [
  { value: "manual", label: "Manual (mark paid in CRM)" },
  { value: "stripe", label: "Stripe (automatic charges)" },
] as const;
