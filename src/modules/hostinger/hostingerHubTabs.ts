export const HOSTINGER_HUB_TABS = [
  "overview",
  "domains",
  "search",
] as const;

export type HostingerHubTab = (typeof HOSTINGER_HUB_TABS)[number];

export const HOSTINGER_HUB_TAB_LABELS: Record<HostingerHubTab, string> = {
  overview: "Overview",
  domains: "Domains",
  search: "Search",
};

export const resolveHostingerHubTab = (
  searchParams: URLSearchParams,
): HostingerHubTab => {
  const raw = searchParams.get("tab");
  if (raw === "settings") {
    return "overview";
  }
  if (raw && HOSTINGER_HUB_TABS.includes(raw as HostingerHubTab)) {
    return raw as HostingerHubTab;
  }
  return "overview";
};
