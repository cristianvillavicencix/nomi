export const LBS_PROJECT_TABS = [
  "overview",
  "website-brief",
  "resources",
  "tasks",
  "chat",
  "delivery",
  "financials",
  "security",
] as const;

export type LbsProjectTab = (typeof LBS_PROJECT_TABS)[number];

/** Old tab slugs still linked from elsewhere in the app. */
const LEGACY_TAB_MAP: Record<string, LbsProjectTab> = {
  files: "resources",
  documents: "resources",
  assets: "resources",
  scope: "financials",
  proposals: "financials",
  contracts: "financials",
  content: "overview",
  "web-forms": "resources",
  activity: "overview",
  settings: "security",
  tickets: "overview",
  schedule: "delivery",
  launch: "delivery",
  maintenance: "delivery",
  expenses: "financials",
  change_orders: "financials",
  payments: "financials",
  commissions: "financials",
  messages: "chat",
  "team-chat": "chat",
  "project-chat": "chat",
};

export const getValidProjectTab = (value: string | null): LbsProjectTab => {
  if (value && LBS_PROJECT_TABS.includes(value as LbsProjectTab)) {
    return value as LbsProjectTab;
  }
  if (value && LEGACY_TAB_MAP[value]) {
    return LEGACY_TAB_MAP[value];
  }
  return "overview";
};

export const resolveProjectTabSelection = (tab: string): LbsProjectTab =>
  LBS_PROJECT_TABS.includes(tab as LbsProjectTab)
    ? (tab as LbsProjectTab)
    : getValidProjectTab(tab);

export const formatTabCount = (count?: number) =>
  count != null && count > 0 ? ` (${count})` : "";
