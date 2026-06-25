import type { PortalCredential, PortalDelivery, PortalDomain } from "@/modules/portal/portalTypes";
import { readPortalHostingMeta } from "@/modules/portal/portalDeliveryMeta";
import {
  PORTAL_HOSTING_CATEGORIES,
  resolvePortalCredentialCategory,
  type PortalCredentialCategory,
} from "@/modules/portal/portalCredentialCategories";

const PROVIDER_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: "Hostinger", keywords: ["hostinger"] },
  { label: "SiteGround", keywords: ["siteground"] },
  { label: "Cloudways", keywords: ["cloudways"] },
  { label: "GoDaddy", keywords: ["godaddy"] },
  { label: "Namecheap", keywords: ["namecheap"] },
  { label: "Cloudflare", keywords: ["cloudflare"] },
  { label: "Bluehost", keywords: ["bluehost"] },
  { label: "DreamHost", keywords: ["dreamhost"] },
  { label: "WordPress", keywords: ["wordpress", "wp-admin", "wp admin"] },
  { label: "Shopify", keywords: ["shopify"] },
  { label: "Webflow", keywords: ["webflow"] },
  { label: "Squarespace", keywords: ["squarespace"] },
  { label: "Wix", keywords: ["wix"] },
  { label: "Google Workspace", keywords: ["google workspace", "gmail"] },
  { label: "cPanel", keywords: ["cpanel"] },
  { label: "Plesk", keywords: ["plesk"] },
];

const normalizeUrl = (url?: string | null) => {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("http") ? raw : `https://${raw}`;
};

export const inferCredentialLocation = (entry: PortalCredential) => {
  const href = normalizeUrl(entry.url);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return entry.url?.trim() ?? null;
  }
};

export const inferCredentialProvider = (entry: PortalCredential) => {
  const haystack = [entry.label, entry.url, entry.username, entry.secret_label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of PROVIDER_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.label;
    }
  }

  const serviceKind = String(entry.service_kind ?? "").trim();
  if (serviceKind) {
    return serviceKind.charAt(0).toUpperCase() + serviceKind.slice(1);
  }

  return null;
};

export const filterCredentialsByCategories = (
  credentials: PortalCredential[],
  categories: PortalCredentialCategory[],
) => {
  const allowed = new Set(categories);
  return credentials.filter((entry) =>
    allowed.has(resolvePortalCredentialCategory(entry)),
  );
};

export const inferPrimaryHostingProvider = (
  credentials: PortalCredential[],
  siteUrl?: string | null,
  delivery?: PortalDelivery | null,
) => {
  const manual = readPortalHostingMeta(delivery).provider;
  if (manual) return manual;

  const hostingEntries = filterCredentialsByCategories(
    credentials,
    PORTAL_HOSTING_CATEGORIES,
  );

  for (const entry of hostingEntries) {
    const provider = inferCredentialProvider(entry);
    if (provider) return provider;
  }

  if (siteUrl) {
    const siteHost = inferCredentialLocation({
      id: 0,
      label: "",
      url: siteUrl,
    });
    if (siteHost) {
      for (const rule of PROVIDER_RULES) {
        if (rule.keywords.some((keyword) => siteHost.includes(keyword))) {
          return rule.label;
        }
      }
    }
  }

  return null;
};

export const inferPrimaryDomainRegistrar = (
  domains: PortalDomain[],
  credentials: PortalCredential[],
  delivery?: PortalDelivery | null,
) => {
  const domainInfo = delivery?.domain_info;
  const manualRegistrar =
    domainInfo &&
    typeof domainInfo === "object" &&
    typeof (domainInfo as Record<string, unknown>).registrar === "string"
      ? String((domainInfo as Record<string, unknown>).registrar).trim()
      : "";
  if (manualRegistrar) return manualRegistrar;

  const registrar = domains[0]?.registrar?.trim();
  if (registrar) return registrar;

  const domainEntries = filterCredentialsByCategories(credentials, ["domain"]);
  for (const entry of domainEntries) {
    const provider = inferCredentialProvider(entry);
    if (provider) return provider;
  }

  return null;
};
