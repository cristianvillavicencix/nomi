import { useStore } from "ra-core";

export type NavigationLayoutMode = "top" | "sidebar";

export const NAVIGATION_LAYOUT_STORE_KEY = "app.preferences.navigationLayout";

export const useNavigationLayoutPreference = () =>
  useStore<NavigationLayoutMode>(NAVIGATION_LAYOUT_STORE_KEY, "top");

