/** Product branding — keep UI short; use full name in email/copy/links text. */

export const PRODUCT_NAME = "SIGMA";

export const PRODUCT_ORG = "Latino Business Support";

/** Full product line for emails, invites, footers, and long-form copy. */
export const PRODUCT_FULL_NAME = "Sigma by Latino Business Support";

export const PRODUCT_TEAM_SIGN_OFF = `The ${PRODUCT_FULL_NAME} team`;

/** App mark for chrome (Ask Sigma, sidebar wordmark asset). Root-absolute path. */
export const PRODUCT_MARK_SRC = "/logos/sigma.png";

/** Browser tab / PWA favicon (same mark as PRODUCT_MARK_SRC). */
export const PRODUCT_FAVICON_SRC = "/favicon.ico";

/** Legacy / alternate labels that should map to the current product name. */
export const LEGACY_PRODUCT_TITLES = [
  "Atomic CRM",
  "LBS CRM",
  "Nomi CRM",
  "NOMI CRM",
  "Nomi",
  "NOMI",
  "LBS",
] as const;

/** Login split-panel hero (Unsplash — team collaboration). */
export const LOGIN_HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1920&q=80";
