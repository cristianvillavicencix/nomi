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

/** Favicon URLs in fallback order (Google S2 allows hotlinking; DuckDuckGo blocks CORS). */
export const getFaviconSourcesForDomain = (domain: string): string[] => {
  const normalized = domain.trim().toLowerCase().replace(/^www\./i, "");
  if (!normalized || !normalized.includes(".")) return [];
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=64`,
    `https://${normalized}/favicon.ico`,
  ];
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
