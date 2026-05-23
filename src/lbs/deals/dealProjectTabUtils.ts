export const LBS_PROJECT_TABS = [
  "overview",
  "scope",
  "website-brief",
  "content",
  "resources",
  "tasks",
  "schedule",
  "launch",
  "messages",
  "expenses",
  "change_orders",
  "payments",
  "commissions",
  "maintenance",
  "activity",
  "settings",
] as const;

export type LbsProjectTab = (typeof LBS_PROJECT_TABS)[number];

/** Old tab slugs still linked from elsewhere in the app. */
const LEGACY_TAB_MAP: Record<string, LbsProjectTab> = {
  files: "resources",
  documents: "resources",
  assets: "resources",
  proposals: "scope",
  contracts: "scope",
  "web-forms": "resources",
  activity: "activity",
  security: "settings",
  tickets: "activity",
};

export const getValidProjectTab = (value: string | null): LbsProjectTab => {
  if (value && LEGACY_TAB_MAP[value]) {
    return LEGACY_TAB_MAP[value];
  }
  return LBS_PROJECT_TABS.includes(value as LbsProjectTab)
    ? (value as LbsProjectTab)
    : "overview";
};

export const formatTabCount = (count?: number) =>
  count != null && count > 0 ? ` (${count})` : "";
