import { useCallback, useSyncExternalStore } from "react";

const LS_KEY = "nomi-crm:navigationLayout";

export type NavigationLayoutMode = "top" | "sidebar";

function readInitial(): NavigationLayoutMode {
  if (typeof window === "undefined") return "top";
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s === "sidebar" || s === "top") return s;
  } catch {
    /* Quota or privacy mode */
  }
  return "top";
}

let modeState: NavigationLayoutMode = readInitial();
const listeners = new Set<() => void>();

function getSnapshot(): NavigationLayoutMode {
  return modeState;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function setLayoutState(next: NavigationLayoutMode) {
  if (next !== "top" && next !== "sidebar") return;
  if (next === modeState) return;
  modeState = next;
  try {
    localStorage.setItem(LS_KEY, next);
  } catch {
    /* */
  }
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    if (e.newValue === "sidebar" || e.newValue === "top") {
      setLayoutState(e.newValue);
    }
  });
}

/**
 * One shared preference for the whole app (unlike a per-component useState).
 * Persists in localStorage so it survives route changes, reloads, and new sessions.
 */
export const useNavigationLayoutPreference = () => {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "top" as NavigationLayoutMode,
  );

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
