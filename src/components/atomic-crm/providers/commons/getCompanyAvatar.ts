import type { Company } from "../../types";

/**
 * Returns a normalized domain like "example.com" extracted from any kind of
 * website URL the user might have typed (with/without https, with/without
 * www, with trailing slashes, paths, query strings, etc.). Returns null if
 * we can't make sense of it.
 */
const extractDomain = (website?: string | null): string | null => {
  const value = website?.trim();
  if (!value) return null;
  const stripped = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim();
  return stripped || null;
};

const faviconUrlFor = (domain: string) =>
  `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Main function to get the avatar URL
export async function getCompanyAvatar(record: Partial<Company>): Promise<{
  src: string;
  title: string;
} | null> {
  const domain = extractDomain(record.website);
  if (!domain) {
    return null;
  }
  return {
    src: faviconUrlFor(domain),
    title: "Company favicon",
  };
}

export const getCompanyFaviconSrc = (
  record: Partial<Company>,
): string | undefined => {
  if (record.logo?.src) {
    return record.logo.src;
  }
  const domain = extractDomain(record.website);
  if (!domain) {
    return undefined;
  }
  return faviconUrlFor(domain);
};
