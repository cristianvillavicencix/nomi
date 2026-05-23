export const WEB_EXPENSE_CATEGORIES = [
  { value: "hosting", label: "Hosting" },
  { value: "domain", label: "Domain" },
  { value: "plugins_themes", label: "Plugins / themes" },
  { value: "stock_images", label: "Stock images" },
  { value: "ssl_certificates", label: "SSL certificates" },
  { value: "third_party_services", label: "Third-party services" },
  { value: "ads_spend", label: "Ads spend" },
  { value: "subcontractor_dev", label: "Freelancer dev" },
  { value: "subcontractor_design", label: "Freelancer design" },
  { value: "other", label: "Other" },
] as const;

export const WEB_EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  WEB_EXPENSE_CATEGORIES.map((item) => [item.value, item.label]),
) as Record<string, string>;

/** Default sales commission when a project reaches a won/delivered stage. */
export const DEFAULT_LBS_COMMISSION_PERCENT = 5;

/** Stages that trigger auto-commission creation (current + future pipeline slugs). */
export const LBS_COMMISSION_WON_STAGES = new Set([
  "won",
  "delivered",
  "closed_won",
  "completed",
]);

export const CHANGE_ORDER_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Planned" },
  { value: "cleared", label: "Received" },
  { value: "deposited", label: "Deposited" },
  { value: "bounced", label: "Bounced" },
] as const;

export const PAYMENT_SCHEDULE_SPLITS = [
  { label: "Deposit", percent: 30 },
  { label: "Milestone 1", percent: 40 },
  { label: "Final", percent: 30 },
] as const;
