import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

export const useRecaptchaToken = (enabled: boolean) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !SITE_KEY) return;

    const existing = document.querySelector('script[data-recaptcha="v3"]');
    if (existing) {
      setReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.dataset.recaptcha = "v3";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [enabled]);

  return useCallback(async () => {
    if (!enabled || !SITE_KEY) return undefined;
    if (!window.grecaptcha) return undefined;

    await new Promise<void>((resolve) => {
      window.grecaptcha!.ready(() => resolve());
    });

    return window.grecaptcha!.execute(SITE_KEY, { action: "submit_form" });
  }, [enabled]);
};

export const recaptchaConfigured = Boolean(SITE_KEY);
