import { buildSubscriptionSetupSharePath } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

/** Public CRM origin for links sent to clients (SMS, email). */
export const DEFAULT_PUBLIC_APP_URL = "https://www.nomicrm.com";

const LOCAL_APP_HOST_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export const resolvePublicAppBaseUrl = (): string => {
  const envUrl =
    String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim() ||
    String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (!LOCAL_APP_HOST_PATTERN.test(origin)) {
      return origin;
    }
  }
  return DEFAULT_PUBLIC_APP_URL;
};

export const resolveSubscriptionSetupShareUrl = (params: {
  setup_share_url?: string | null;
  setup_short_code?: string | null;
}): string => {
  const base = resolvePublicAppBaseUrl();
  const shortCode = params.setup_short_code?.trim();
  if (shortCode) {
    return `${base}${buildSubscriptionSetupSharePath(shortCode)}`;
  }

  const stored = params.setup_share_url?.trim();
  if (stored) {
    const shortCodeFromStored = stored.match(/\/sub\/([^/?#]+)/i)?.[1];
    if (shortCodeFromStored && LOCAL_APP_HOST_PATTERN.test(stored)) {
      return `${base}${buildSubscriptionSetupSharePath(shortCodeFromStored)}`;
    }
    if (!LOCAL_APP_HOST_PATTERN.test(stored)) {
      return stored;
    }
  }

  return `${base}/sub/…`;
};
