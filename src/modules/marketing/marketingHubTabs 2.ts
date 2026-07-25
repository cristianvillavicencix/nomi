export const MARKETING_HUB_TABS = ["sms", "email"] as const;

export type MarketingHubTab = (typeof MARKETING_HUB_TABS)[number];

export const MARKETING_HUB_TAB_LABELS: Record<MarketingHubTab, string> = {
  sms: "SMS campaigns",
  email: "Email campaigns",
};

export const isMarketingHubTab = (value: string): value is MarketingHubTab =>
  MARKETING_HUB_TABS.includes(value as MarketingHubTab);

export const resolveMarketingHubTab = (
  searchParams: URLSearchParams,
): MarketingHubTab => {
  const tab = searchParams.get("tab");
  return tab && isMarketingHubTab(tab) ? tab : "sms";
};
