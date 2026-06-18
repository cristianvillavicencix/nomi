/** Public CRM origin (invoice/proposal portal, forms). Not the marketing site (lbs.bz). */
export const DEFAULT_PUBLIC_APP_URL = "https://www.nomicrm.com";

export const resolvePublicAppBaseUrl = () => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("BILLING_PUBLIC_SITE_URL")?.trim();
  return envUrl?.replace(/\/$/, "") || DEFAULT_PUBLIC_APP_URL;
};
