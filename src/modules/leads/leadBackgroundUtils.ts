import type { Company, Contact } from "@/components/atomic-crm/types";

const normalizeWebsite = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s<>"']*)?/i;

export const extractWebsiteFromText = (text: string): string | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = normalizeWebsite(trimmed);
  if (direct && !trimmed.includes("\n") && trimmed.split(/\s+/).length === 1) {
    return direct;
  }

  const match = trimmed.match(URL_PATTERN);
  return match ? normalizeWebsite(match[0]) : null;
};

export const resolveLeadWebsiteUrl = (
  lead: Contact,
  company?: Company | null,
): string | null => {
  const companyWebsite = company?.website?.trim();
  if (companyWebsite) {
    return normalizeWebsite(companyWebsite);
  }

  return extractWebsiteFromText(lead.background ?? "");
};

export const formatLeadWebsiteLabel = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
};

export const getLeadBackgroundText = (lead: Contact) =>
  lead.background?.trim() ?? "";
