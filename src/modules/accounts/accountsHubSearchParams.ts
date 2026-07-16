export type AccountsHubView = "list" | "board";

export const ACCOUNTS_VIEW_STORAGE_KEY = "lbs.accounts.view";

export const parseAccountsHubView = (
  raw: string | null | undefined,
): AccountsHubView | null => {
  if (raw === "list" || raw === "board") return raw;
  return null;
};

export const readPersistedAccountsView = (): AccountsHubView => {
  if (typeof window === "undefined") return "list";
  const stored = window.localStorage.getItem(ACCOUNTS_VIEW_STORAGE_KEY);
  return stored === "board" ? "board" : "list";
};

export const persistAccountsView = (view: AccountsHubView) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_VIEW_STORAGE_KEY, view);
};

/** Keep `?view=` in sync with the active mode (omit for default list). */
export const syncAccountsHubSearchParams = (
  activeView: AccountsHubView,
  current: URLSearchParams,
): URLSearchParams | null => {
  const next = new URLSearchParams(current);
  const currentView = parseAccountsHubView(next.get("view"));

  if (activeView === "list") {
    if (currentView == null || currentView === "list") {
      if (!next.has("view")) return null;
      next.delete("view");
      return next;
    }
    next.delete("view");
    return next;
  }

  if (currentView === "board") return null;
  next.set("view", "board");
  return next;
};

export const buildAccountsHubViewChangeParams = (
  view: AccountsHubView,
  current: URLSearchParams,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  if (view === "list") {
    next.delete("view");
  } else {
    next.set("view", "board");
  }
  return next;
};
