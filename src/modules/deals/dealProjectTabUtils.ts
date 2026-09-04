export const LBS_PROJECT_TABS = [
  "tasks",
  "website-brief",
  "resources",
  "security",
  "financials",
  "messages",
  "overview",
] as const;

export type LbsProjectTab = (typeof LBS_PROJECT_TABS)[number];

export const DEFAULT_PROJECT_TAB: LbsProjectTab = "tasks";

/** Old tab slugs still linked from elsewhere in the app. */
const LEGACY_TAB_MAP: Record<string, LbsProjectTab> = {
  files: "resources",
  documents: "resources",
  assets: "resources",
  multimedia: "resources",
  scope: "financials",
  proposals: "financials",
  contracts: "financials",
  content: "overview",
  "web-forms": "resources",
  activity: "overview",
  activities: "overview",
  settings: "security",
  tickets: "overview",
  schedule: "tasks",
  calendar: "tasks",
  launch: "overview",
  maintenance: "financials",
  delivery: "overview",
  expenses: "financials",
  change_orders: "financials",
  payments: "financials",
  commissions: "financials",
  // Removed / renamed tabs — redirect to safe defaults.
  chat: "messages",
  "team-chat": "messages",
  "project-chat": "messages",
};

export const getValidProjectTab = (value: string | null): LbsProjectTab => {
  if (value && LBS_PROJECT_TABS.includes(value as LbsProjectTab)) {
    return value as LbsProjectTab;
  }
  if (value && LEGACY_TAB_MAP[value]) {
    return LEGACY_TAB_MAP[value];
  }
  return DEFAULT_PROJECT_TAB;
};

export const resolveProjectTabSelection = (tab: string): LbsProjectTab =>
  LBS_PROJECT_TABS.includes(tab as LbsProjectTab)
    ? (tab as LbsProjectTab)
    : getValidProjectTab(tab);

export const formatTabCount = (count?: number) =>
  count != null && count > 0 ? ` (${count})` : "";
