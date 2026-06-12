import type { Company } from "../../types";
import {
  expandFaviconSources,
  extractDomainFromUrl,
  getFaviconSourcesForWebsite,
  getPrimaryFaviconSrc,
  isLegacyStoredFaviconUrl,
} from "@/lib/faviconSources";

// Main function to get the avatar URL
export async function getCompanyAvatar(record: Partial<Company>): Promise<{
  src: string;
  title: string;
} | null> {
  const sources = getFaviconSourcesForWebsite(record.website);
  if (!sources.length) {
    return null;
  }
  return {
    src: sources[0],
    title: "Company favicon",
  };
}

export const getCompanyFaviconSources = (
  record: Partial<Company>,
): string[] => {
  const logoSrc = record.logo?.src?.trim();
  const websiteSources = getFaviconSourcesForWebsite(record.website);

  if (!logoSrc) {
    return websiteSources;
  }

  if (isLegacyStoredFaviconUrl(logoSrc)) {
    const legacySources = expandFaviconSources([logoSrc], record.website);
    const merged = [...websiteSources];
    for (const url of legacySources) {
      if (!merged.includes(url)) merged.push(url);
    }
    return merged.length ? merged : websiteSources;
  }

  return expandFaviconSources([logoSrc], record.website);
};

export const getCompanyFaviconSrc = (
  record: Partial<Company>,
): string | undefined => {
  const sources = getCompanyFaviconSources(record);
  return sources[0];
};

/** @deprecated Use extractDomainFromUrl from @/lib/faviconSources */
export const extractCompanyDomain = extractDomainFromUrl;

/** Primary favicon for a website string (no Company record). */
export { getPrimaryFaviconSrc };
