import type { Company } from "../../types";
import {
  extractDomainFromUrl,
  getFaviconSourcesForWebsite,
  getPrimaryFaviconSrc,
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
  if (record.logo?.src?.trim()) {
    return [record.logo.src.trim()];
  }
  return getFaviconSourcesForWebsite(record.website);
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
