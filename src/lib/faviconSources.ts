/** Normalize a website or host string to a bare domain (example.com). */
export const extractDomainFromUrl = (url?: string | null): string | null => {
  const value = url?.trim();
  if (!value) return null;
  const stripped = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase();
  return stripped || null;
};

/** Legacy DB rows still point at DuckDuckGo; map them back to Google S2. */
const LEGACY_DUCKDUCKGO_FAVICON_RE =
  /^https:\/\/icons\.duckduckgo\.com\/ip3\/([^/?#]+)/i;

const LEGACY_FAVICON_SHOW_RE = /^https:\/\/favicon\.show\/([^/?#]+)/i;

const LEGACY_GSTATIC_FAVICON_RE = /gstatic\.com\/faviconV2/i;

/** Strip DuckDuckGo's trailing `.ico` suffix from the captured host segment. */
const normalizeLegacyFaviconHost = (host: string): string | null => {
  const trimmed = host.trim().replace(/\.ico$/i, "").replace(/^www\./i, "");
  return trimmed.includes(".") ? trimmed.toLowerCase() : null;
};

/** Resolve a stored favicon URL (DuckDuckGo, gstatic, favicon.show, etc.) to a bare domain. */
export const extractDomainFromStoredFaviconUrl = (
  url?: string | null,
): string | null => {
  const value = url?.trim();
  if (!value) return null;

  const duckduckgo = value.match(LEGACY_DUCKDUCKGO_FAVICON_RE);
  if (duckduckgo) {
    return normalizeLegacyFaviconHost(duckduckgo[1]);
  }

  const faviconShow = value.match(LEGACY_FAVICON_SHOW_RE);
  if (faviconShow) {
    return normalizeLegacyFaviconHost(faviconShow[1]);
  }

  if (LEGACY_GSTATIC_FAVICON_RE.test(value)) {
    try {
      const parsed = new URL(value);
      const siteUrl = parsed.searchParams.get("url");
      if (siteUrl) {
        const fromParam = extractDomainFromUrl(siteUrl);
        if (fromParam) return fromParam;
      }
    } catch {
      // ignore malformed stored URLs
    }
  }

  if (/^https?:\/\/.+\.ico(?:[/?#]|$)/i.test(value)) {
    return extractDomainFromUrl(value.replace(/\.ico(?=[/?#]|$)/i, ""));
  }

  return extractDomainFromUrl(value);
};

/** True when `logo.src` / `avatar.src` is a generated favicon URL, not a user upload. */
export const isLegacyStoredFaviconUrl = (url?: string | null): boolean => {
  const value = url?.trim();
  if (!value) return false;
  if (LEGACY_DUCKDUCKGO_FAVICON_RE.test(value)) return true;
  if (LEGACY_FAVICON_SHOW_RE.test(value)) return true;
  if (LEGACY_GSTATIC_FAVICON_RE.test(value)) return true;
  if (/^https?:\/\/[^/?#]+\.ico(?:[/?#]|$)/i.test(value)) return true;
  if (value.includes("google.com/s2/favicons")) return true;
  return false;
};

/** Favicon URLs in fallback order (Google S2 hotlinks reliably; skip direct /favicon.ico to avoid noisy 404s). */
export const getFaviconSourcesForDomain = (domain: string): string[] => {
  const normalized = domain.trim().toLowerCase().replace(/^www\./i, "");
  if (!normalized || !normalized.includes(".")) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=64`,
  ];
};

/** Expand stored logo/avatar URLs, replacing legacy favicon services with live Google S2 sources. */
export const expandFaviconSources = (
  sources: Array<string | null | undefined>,
  fallbackWebsite?: string | null,
): string[] => {
  const expanded: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    expanded.push(url);
  };

  const pushDomain = (domain: string | null | undefined) => {
    if (!domain) return;
    for (const url of getFaviconSourcesForDomain(domain)) {
      pushUnique(url);
    }
  };

  for (const source of sources) {
    const value = source?.trim();
    if (!value) continue;

    const legacyDomain = extractDomainFromStoredFaviconUrl(value);
    if (legacyDomain && isLegacyStoredFaviconUrl(value)) {
      pushDomain(legacyDomain);
      continue;
    }

    pushUnique(value);
  }

  if (!expanded.length && fallbackWebsite) {
    for (const url of getFaviconSourcesForWebsite(fallbackWebsite)) {
      pushUnique(url);
    }
  }

  return expanded;
};

export const getFaviconSourcesForWebsite = (
  website?: string | null,
): string[] => {
  const domain = extractDomainFromUrl(website);
  return domain ? getFaviconSourcesForDomain(domain) : [];
};

export const getPrimaryFaviconSrc = (
  website?: string | null,
): string | undefined => getFaviconSourcesForWebsite(website)[0];

export const getFaviconSourcesForEmail = (email?: string | null): string[] => {
  const domain = email?.split("@")[1]?.trim().replace(/^www\./i, "").toLowerCase();
  return domain ? getFaviconSourcesForDomain(domain) : [];
};
