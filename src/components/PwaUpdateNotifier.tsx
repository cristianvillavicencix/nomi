import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * Prompts when a new service worker is waiting (post-deploy).
 * Complements chunk reload handling in main.tsx.
 */
export const PwaUpdateNotifier = () => {
  useEffect(() => {
    registerSW({
      onNeedRefresh() {
        const shouldReload = window.confirm(
          "A new version of Nomi is available. Reload now to get the latest updates?",
        );
        if (shouldReload) {
          window.location.reload();
        }
      },
    });
  }, []);

  return null;
};
