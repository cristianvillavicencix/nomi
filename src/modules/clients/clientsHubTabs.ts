export const CLIENTS_HUB_TABS = ["companies", "people"] as const;

export type ClientsHubTab = (typeof CLIENTS_HUB_TABS)[number];

export type ResolveClientsHubTabInput = {
  pathname: string;
  searchParams: Pick<URLSearchParams, "get">;
};

const PATHNAME_LOCKED_TAB: Partial<Record<string, ClientsHubTab>> = {
  "/companies": "companies",
  "/contacts": "people",
};

const parseTabQuery = (raw: string | null): ClientsHubTab | null => {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "people" || normalized === "contacts") return "people";
  if (normalized === "companies" || normalized === "company")
    return "companies";
  return null;
};

/**
 * Resolves the active Clients hub tab from the current URL.
 * Pathname locks alias list routes; `/clients` honors `?tab=` (legacy `contacts` → people).
 */
export const resolveClientsHubTab = ({
  pathname,
  searchParams,
}: ResolveClientsHubTabInput): ClientsHubTab => {
  const lockedTab = PATHNAME_LOCKED_TAB[pathname];
  if (lockedTab) return lockedTab;

  return parseTabQuery(searchParams.get("tab")) ?? "companies";
};
