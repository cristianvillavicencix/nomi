/** Public CRM origin (invoice/proposal portal, forms). Not the marketing site (lbs.bz). */
export const DEFAULT_PUBLIC_APP_URL = "https://www.nomicrm.com";

const LOCAL_APP_HOST_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export const resolvePublicAppBaseUrl = () => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("BILLING_PUBLIC_SITE_URL")?.trim();
  return envUrl?.replace(/\/$/, "") || DEFAULT_PUBLIC_APP_URL;
};

/** Prefer server-configured origin; ignore localhost sent from dev browsers. */
export const resolveClientAppBaseUrl = (requested?: string | null) => {
  const trimmed = requested?.trim()?.replace(/\/$/, "");
  if (trimmed && !LOCAL_APP_HOST_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return resolvePublicAppBaseUrl();
};
