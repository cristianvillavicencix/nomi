import { useCallback, useSyncExternalStore } from "react";

const LS_KEY = "nomi-crm:navigationLayout";

export type NavigationLayoutMode = "top" | "sidebar";

const DEFAULT_MODE: NavigationLayoutMode = "sidebar";

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

function setLayoutState(next: NavigationLayoutMode) {
  if (next !== "top" && next !== "sidebar") return;
  if (readFromStorage() === next) {
    return;
  }
  try {
    localStorage.setItem(LS_KEY, next);
  } catch {
    return;
  }
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    emit();
  });
}

/**
 * One shared preference for the whole app (unlike a per-component useState).
 * Persists in localStorage. getSnapshot always reads from storage so it stays
 * the source of truth (no stale module-level state after reload or other writers).
 */
export const useNavigationLayoutPreference = () => {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback(
    (next: NavigationLayoutMode | ((prev: NavigationLayoutMode) => NavigationLayoutMode)) => {
      const prev = getSnapshot();
      const resolved = typeof next === "function" ? (next as (p: NavigationLayoutMode) => NavigationLayoutMode)(prev) : next;
      if (resolved === "top" || resolved === "sidebar") {
        setLayoutState(resolved);
      }
    },
    [],
  );

  return [mode, setMode] as const;
};
