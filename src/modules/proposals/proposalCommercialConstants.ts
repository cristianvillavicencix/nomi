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
  termination_notice_days: "14",
  warranty_days: "30",
  late_days: "15",
  late_fee: "5%",
  currency: "USD",
  lbs_signatory: "Latinos Business Support LLC",
} as const;

export type ClientBillingMode = "manual" | "stripe";

export const CLIENT_BILLING_MODES = [
  { value: "manual", label: "Manual (mark paid in CRM)" },
  { value: "stripe", label: "Stripe (automatic charges)" },
] as const;
