import type { Contact } from "@/components/atomic-crm/types";

export const CLIENT_TABS = [
  "overview",
  "contacts",
  "projects",
  "financial",
  "activity",
] as const;

export type ClientTab = (typeof CLIENT_TABS)[number];

export const FINANCIAL_SECTIONS = [
  "summary",
  "proposals",
  "contracts",
  "payments",
] as const;

export type FinancialSection = (typeof FINANCIAL_SECTIONS)[number];

export const ACTIVITY_SECTIONS = ["feed", "notes", "tasks", "support"] as const;

export type ActivitySection = (typeof ACTIVITY_SECTIONS)[number];

const LEGACY_TAB_MAP: Record<
  string,
  { tab: ClientTab; section?: FinancialSection | ActivitySection }
> = {
  proposals: { tab: "financial", section: "proposals" },
  contracts: { tab: "financial", section: "contracts" },
  tickets: { tab: "activity", section: "support" },
  "web-forms": { tab: "activity", section: "support" },
  tasks: { tab: "activity", section: "tasks" },
  notes: { tab: "activity", section: "notes" },
  files: { tab: "projects" },
};

export const resolveClientTabFromUrl = (
  tab: string | null,
): { tab: ClientTab; section?: string } => {
  if (tab && LEGACY_TAB_MAP[tab]) {
    return LEGACY_TAB_MAP[tab];
  }
  return { tab: getValidClientTab(tab) };
};

export const getValidClientTab = (value: string | null): ClientTab =>
  CLIENT_TABS.includes(value as ClientTab) ? (value as ClientTab) : "overview";

export const getValidFinancialSection = (
  value: string | null,
): FinancialSection =>
  FINANCIAL_SECTIONS.includes(value as FinancialSection)
    ? (value as FinancialSection)
    : "summary";

export const getValidActivitySection = (
  value: string | null,
): ActivitySection =>
  ACTIVITY_SECTIONS.includes(value as ActivitySection)
    ? (value as ActivitySection)
    : "feed";

export const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const getContactEmail = (contact: Contact) =>
  contact.email_jsonb?.find((entry) => entry.email?.trim())?.email?.trim() ||
  "—";

export const getContactPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((entry) => entry.number?.trim())?.number?.trim() ||
  "—";

export const getContactFullName = (contact: Contact) =>
  `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "—";

export const formatTabCount = (count?: number) =>
  count != null && count > 0 ? ` (${count})` : "";
