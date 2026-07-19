import { useCallback, useSyncExternalStore } from "react";

const LS_KEY = "nomi-crm:navigationLayout";

export type NavigationLayoutMode = "top" | "sidebar";

const DEFAULT_MODE: NavigationLayoutMode = "sidebar";

export const NAVIGATION_LAYOUT_UI_PREF_KEY = "navigation_layout";

function readFromStorage(): NavigationLayoutMode {
  if (typeof window === "undefined") {
    return DEFAULT_MODE;
  }
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s === "sidebar" || s === "top") return s;
  } catch {
    /* Quota or privacy mode */
  }
  return DEFAULT_MODE;
}

const listeners = new Set<() => void>();

function getSnapshot(): NavigationLayoutMode {
  return readFromStorage();
}

/** Matches initial client read when `window` is undefined (e.g. SSR / server render). */
const getServerSnapshot = getSnapshot;

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

type AccountPersistFn = (mode: NavigationLayoutMode) => void;

let accountPersist: AccountPersistFn | null = null;

/**
 * Register a callback that writes the layout preference to the signed-in
 * member account. Used by NavigationLayoutAccountSync.
 */
export function registerNavigationLayoutAccountPersist(
  fn: AccountPersistFn | null,
) {
  accountPersist = fn;
  return () => {
    if (accountPersist === fn) {
      accountPersist = null;
    }
  };
}

export function parseNavigationLayoutFromUiPrefs(
  uiPrefs: Record<string, unknown> | null | undefined,
): NavigationLayoutMode | null {
  if (!uiPrefs || typeof uiPrefs !== "object") return null;
  const value = uiPrefs[NAVIGATION_LAYOUT_UI_PREF_KEY];
  if (value === "sidebar" || value === "top") return value;
  return null;
}

function setLayoutState(next: NavigationLayoutMode, options?: { persist?: boolean }) {
  if (next !== "top" && next !== "sidebar") return;
  const changed = readFromStorage() !== next;
  if (changed) {
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      return;
    }
    emit();
  }
  if (options?.persist !== false) {
    accountPersist?.(next);
  }
}

/**
 * Apply account preference into localStorage without writing back to the account
 * (avoids a save loop on hydrate).
 */
export function hydrateNavigationLayoutFromAccount(mode: NavigationLayoutMode) {
  setLayoutState(mode, { persist: false });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    emit();
  });
}

/**
 * One shared preference for the whole app (unlike a per-component useState).
 * Instant UI uses localStorage; NavigationLayoutAccountSync mirrors it to the
 * member `ui_prefs` so the choice follows the account across devices.
 */
export const useNavigationLayoutPreference = () => {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback(
    (
      next:
        | NavigationLayoutMode
        | ((prev: NavigationLayoutMode) => NavigationLayoutMode),
    ) => {
      const prev = getSnapshot();
      const resolved =
        typeof next === "function"
          ? (next as (p: NavigationLayoutMode) => NavigationLayoutMode)(prev)
          : next;
      if (resolved === "top" || resolved === "sidebar") {
        setLayoutState(resolved, { persist: true });
      }
    },
    [],
  );

  return [mode, setMode] as const;
};
