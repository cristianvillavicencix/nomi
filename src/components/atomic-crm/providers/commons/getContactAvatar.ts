import { fetchWithTimeout } from "../../misc/fetchWithTimeout";
import { DOMAINS_NOT_SUPPORTING_FAVICON } from "../../misc/unsupportedDomains.const";
import type { Contact } from "../../types";

export async function hash(string: string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((bytes) => bytes.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// Helper function to get the Gravatar URL
async function getGravatarUrl(email: string): Promise<string> {
  const hashEmail = await hash(email);
  return `https://www.gravatar.com/avatar/${hashEmail}?d=404`;
}

// Helper function to get the favicon URL
async function getFaviconUrl(domain: string): Promise<string | null> {
  if (DOMAINS_NOT_SUPPORTING_FAVICON.includes(domain)) {
    return null;
  }

  try {
    const faviconUrl = `https://${domain}/favicon.ico`;
    const response = await fetchWithTimeout(faviconUrl);
    if (response.ok) {
      return faviconUrl;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Synchronous best-effort avatar URL for a contact, used when the contact
 * does not have an explicit `avatar.src` uploaded. We do not try Gravatar
 * here because it requires async hashing; falling back to the favicon of
 * the email domain (via favicon.show) keeps the avatar component pure
 * synchronous while still showing something meaningful for imported
 * records (e.g. Zoho contacts) that only have an email on file.
 */
export const getContactAvatarSrc = (
  record: Partial<Contact>,
): string | undefined => {
  if (record.avatar?.src) {
    return record.avatar.src;
  }
  const firstEmail = record.email_jsonb?.find(
    (entry) => typeof entry?.email === "string" && entry.email.trim().length > 0,
  )?.email;
  if (!firstEmail) {
    return undefined;
  }
  const domain = firstEmail.split("@")[1]?.trim();
  if (!domain) {
    return undefined;
  }
  return `https://favicon.show/${domain}`;
};

// Main function to get the avatar URL
export async function getContactAvatar(
  record: Partial<Contact>,
): Promise<string | null> {
  if (!record.email_jsonb || !record.email_jsonb.length) {
    return null;
  }

  for (const { email } of record.email_jsonb) {
    // Step 1: Try to get Gravatar image
    const gravatarUrl = await getGravatarUrl(email);
    try {
      const gravatarResponse = await fetch(gravatarUrl);
      if (gravatarResponse.ok) {
        return gravatarUrl;
      }
    } catch {
      // Gravatar not found
    }

    // Step 2: Try to get favicon from email domain
    const domain = email.split("@")[1];
    const faviconUrl = await getFaviconUrl(domain);
    if (faviconUrl) {
      return faviconUrl;
    }

    // TODO: Step 3: Try to get image from LinkedIn.
  }

  return null;
}
