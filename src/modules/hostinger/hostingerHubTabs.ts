export const HOSTINGER_HUB_TABS = ["domains", "search"] as const;

export type HostingerHubTab = (typeof HOSTINGER_HUB_TABS)[number];

export const HOSTINGER_HUB_TAB_LABELS: Record<HostingerHubTab, string> = {
  domains: "Domains",
  search: "Search",
};

const LEGACY_TAB_REDIRECTS: Record<string, HostingerHubTab> = {
  overview: "domains",
  attention: "domains",
  settings: "domains",
};

export const resolveHostingerHubTab = (
  searchParams: URLSearchParams,
): HostingerHubTab => {
  const raw = searchParams.get("tab");
  if (raw && LEGACY_TAB_REDIRECTS[raw]) {
    return LEGACY_TAB_REDIRECTS[raw];
  }
  if (raw && HOSTINGER_HUB_TABS.includes(raw as HostingerHubTab)) {
    return raw as HostingerHubTab;
  }
  return "domains";
};
