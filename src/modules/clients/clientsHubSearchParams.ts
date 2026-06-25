import type { ClientsHubTab } from "@/modules/clients/clientsHubTabs";

export type ClientsHubTabNavigateTarget =
  | { type: "pathname"; path: string }
  | { type: "search"; params: URLSearchParams };

/** Returns updated search params when the URL tab must match the allowed active tab. */
export const syncClientsHubSearchParams = (
  activeTab: ClientsHubTab,
  current: URLSearchParams,
): URLSearchParams | null => {
  const next = new URLSearchParams(current);

  if (activeTab === "companies") {
    if (!next.has("tab")) return null;
    next.delete("tab");
    return next;
  }

  const tabParam = next.get("tab");
  if (tabParam === "people" || tabParam === "contacts") return null;
  next.set("tab", "people");
  return next;
};

export const buildClientsHubTabChangeParams = (
  tab: ClientsHubTab,
  current: URLSearchParams,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  if (tab === "companies") {
    next.delete("tab");
  } else {
    next.set("tab", "people");
  }
  return next;
};

/**
 * On `/clients`, tab changes update query params. On `/companies` or `/contacts`,
 * tab changes navigate to the matching list alias so the pathname lock stays correct.
 */
export const getClientsHubTabNavigateTarget = (
  tab: ClientsHubTab,
  pathname: string,
  searchParams: URLSearchParams,
): ClientsHubTabNavigateTarget => {
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  if (pathname === "/companies") {
    if (tab === "companies") {
      return { type: "pathname", path: `/companies${suffix}` };
    }
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    const nextQuery = next.toString();
    return {
      type: "pathname",
      path: `/contacts${nextQuery ? `?${nextQuery}` : ""}`,
    };
  }

  if (pathname === "/contacts") {
    if (tab === "people") {
      return { type: "pathname", path: `/contacts${suffix}` };
    }
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    const nextQuery = next.toString();
    return {
      type: "pathname",
      path: `/companies${nextQuery ? `?${nextQuery}` : ""}`,
    };
  }

  return {
    type: "search",
    params: buildClientsHubTabChangeParams(tab, searchParams),
  };
};
