import type { PortalCopy } from "@/modules/portal/portalI18n";
import type { PortalCredential } from "@/modules/portal/portalTypes";

export type PortalCredentialCategory =
  | "hosting"
  | "website"
  | "ftp"
  | "domain"
  | "email"
  | "marketing"
  | "api"
  | "other";

export const PORTAL_CREDENTIAL_CATEGORY_ORDER: PortalCredentialCategory[] = [
  "hosting",
  "website",
  "ftp",
  "domain",
  "email",
  "marketing",
  "api",
  "other",
];

export const PORTAL_HOSTING_CATEGORIES: PortalCredentialCategory[] = [
  "hosting",
  "website",
  "ftp",
];

export const PORTAL_DOMAIN_CATEGORIES: PortalCredentialCategory[] = ["domain"];

/** @deprecated Use PORTAL_HOSTING_CATEGORIES + PORTAL_DOMAIN_CATEGORIES */
export const PORTAL_HOSTING_DOMAIN_CATEGORIES: PortalCredentialCategory[] = [
  ...PORTAL_HOSTING_CATEGORIES,
  ...PORTAL_DOMAIN_CATEGORIES,
];

export const PORTAL_OTHER_ACCESS_CATEGORIES: PortalCredentialCategory[] = [
  "email",
  "marketing",
  "api",
  "other",
];

const CATEGORY_KEYWORDS: Record<
  Exclude<PortalCredentialCategory, "other">,
  string[]
> = {
  hosting: [
    "hosting",
    "hostinger",
    "siteground",
    "cloudways",
    "cpanel",
    "plesk",
    "server",
    "servidor",
    "bluehost",
    "dreamhost",
  ],
  website: [
    "wordpress",
    "wp-admin",
    "wp admin",
    "cms",
    "webflow",
    "shopify",
    "squarespace",
    "wix",
    "staging",
    "admin",
  ],
  ftp: ["ftp", "sftp", "filezilla"],
  domain: [
    "domain",
    "dominio",
    "dns",
    "godaddy",
    "namecheap",
    "cloudflare",
    "registrar",
  ],
  email: [
    "email",
    "correo",
    "gmail",
    "outlook",
    "workspace",
    "zoho mail",
    "mail",
  ],
  marketing: [
    "google business",
    "google analytics",
    "analytics",
    "search console",
    "facebook",
    "meta",
    "instagram",
    "seo",
    "ads",
    "tag manager",
  ],
  api: ["api", "api key", "token", "webhook"],
};

const matchesKeywords = (haystack: string, keywords: string[]) =>
  keywords.some((keyword) => haystack.includes(keyword));

export const resolvePortalCredentialCategory = (
  entry: PortalCredential,
): PortalCredentialCategory => {
  if (entry.kind === "api_key") return "api";

  const serviceKind = String(entry.service_kind ?? "")
    .trim()
    .toLowerCase();
  if (
    serviceKind &&
    PORTAL_CREDENTIAL_CATEGORY_ORDER.includes(
      serviceKind as PortalCredentialCategory,
    )
  ) {
    return serviceKind as PortalCredentialCategory;
  }

  const haystack = [entry.label, entry.url, entry.secret_label, entry.username]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const category of PORTAL_CREDENTIAL_CATEGORY_ORDER) {
    if (category === "other") continue;
    if (matchesKeywords(haystack, CATEGORY_KEYWORDS[category])) {
      return category;
    }
  }

  return "other";
};

export const groupPortalCredentials = (
  credentials: PortalCredential[],
  categories?: PortalCredentialCategory[],
) => {
  const allowed = categories ? new Set(categories) : null;
  const buckets = new Map<PortalCredentialCategory, PortalCredential[]>();

  for (const entry of credentials) {
    const category = resolvePortalCredentialCategory(entry);
    if (allowed && !allowed.has(category)) continue;
    const current = buckets.get(category) ?? [];
    current.push(entry);
    buckets.set(category, current);
  }

  const order = categories ?? PORTAL_CREDENTIAL_CATEGORY_ORDER;
  return order
    .filter((category) => buckets.has(category))
    .map((category) => ({
      category,
      items: (buckets.get(category) ?? []).sort(
        (left, right) =>
          (left.portal_sort_order ?? 0) - (right.portal_sort_order ?? 0),
      ),
    }));
};

export const getPortalCredentialCategoryLabel = (
  category: PortalCredentialCategory,
  copy: PortalCopy,
) => {
  switch (category) {
    case "hosting":
      return copy.credentialCategoryHosting;
    case "website":
      return copy.credentialCategoryWebsite;
    case "ftp":
      return copy.credentialCategoryFtp;
    case "domain":
      return copy.credentialCategoryDomain;
    case "email":
      return copy.credentialCategoryEmail;
    case "marketing":
      return copy.credentialCategoryMarketing;
    case "api":
      return copy.credentialCategoryApi;
    default:
      return copy.credentialCategoryOther;
  }
};
