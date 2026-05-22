import type { Company } from "../../types";

// Main function to get the avatar URL
export async function getCompanyAvatar(record: Partial<Company>): Promise<{
  src: string;
  title: string;
} | null> {
  // TODO: Step 1: Try to get image from LinkedIn.

  // Step 2: Fallback to the favicon from website domain
  if (!record.website) {
    return null;
  }
  const websiteUrlWithoutScheme = record.website
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return {
    src: `https://favicon.show/${websiteUrlWithoutScheme}`,
    title: "Company favicon",
  };
}

export const getCompanyFaviconSrc = (record: Partial<Company>): string | undefined => {
  if (record.logo?.src) {
    return record.logo.src;
  }
  if (!record.website?.trim()) {
    return undefined;
  }
  const websiteUrlWithoutScheme = record.website
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://favicon.show/${websiteUrlWithoutScheme}`;
};
