import type { LucideIcon } from "lucide-react";
import {
  Facebook,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  X,
  Youtube,
} from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";

export type ClientSocialLinkValue = {
  url: string;
  network?: string;
  label?: string;
};

export type ClientSocialLink = ClientSocialLinkValue;

export type SocialNetworkOption = {
  id: string;
  label: string;
  Icon: LucideIcon;
};

export const SOCIAL_NETWORK_OPTIONS: SocialNetworkOption[] = [
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "facebook", label: "Facebook", Icon: Facebook },
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "x", label: "X", Icon: X },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "tiktok", label: "TikTok", Icon: Link2 },
  { id: "pinterest", label: "Pinterest", Icon: Link2 },
  { id: "other", label: "Other", Icon: Globe },
];

const NETWORK_MAP = Object.fromEntries(
  SOCIAL_NETWORK_OPTIONS.map((option) => [option.id, option]),
) as Record<string, SocialNetworkOption>;

export const getSocialNetworkOption = (network?: string | null) => {
  const key = network?.trim().toLowerCase();
  if (!key) return NETWORK_MAP.other;
  return NETWORK_MAP[key] ?? NETWORK_MAP.other;
};

export const normalizeSocialUrl = (url?: string | null) => {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

export const detectSocialNetworkFromUrl = (url?: string | null): string => {
  const normalized = normalizeSocialUrl(url).toLowerCase();
  if (!normalized) return "other";

  const hostPatterns: [RegExp, string][] = [
    [/linkedin\.com/i, "linkedin"],
    [/facebook\.com|fb\.com/i, "facebook"],
    [/instagram\.com/i, "instagram"],
    [/twitter\.com|x\.com/i, "x"],
    [/youtube\.com|youtu\.be/i, "youtube"],
    [/tiktok\.com/i, "tiktok"],
    [/pinterest\.com/i, "pinterest"],
  ];

  for (const [pattern, network] of hostPatterns) {
    if (pattern.test(normalized)) return network;
  }

  return "other";
};

export const resolveSocialNetwork = (link: ClientSocialLinkValue) =>
  link.network?.trim().toLowerCase() || detectSocialNetworkFromUrl(link.url);

export const getSocialLinkLabel = (link: ClientSocialLinkValue) => {
  const network = resolveSocialNetwork(link);
  if (network === "other") {
    if (link.label?.trim()) return link.label.trim();
    try {
      return new URL(normalizeSocialUrl(link.url)).hostname.replace(/^www\./, "");
    } catch {
      return "Link";
    }
  }
  return getSocialNetworkOption(network).label;
};

const dedupeSocialLinks = (links: ClientSocialLinkValue[]) => {
  const seen = new Set<string>();
  return links.filter((link) => {
    const url = normalizeSocialUrl(link.url).toLowerCase();
    if (!url) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

export const cleanSocialLinksForSave = (links?: ClientSocialLinkValue[] | null) =>
  dedupeSocialLinks(
    (links ?? [])
      .map((link) => {
        const url = normalizeSocialUrl(link.url);
        if (!url) return null;
        return {
          network: detectSocialNetworkFromUrl(url),
          url,
        };
      })
      .filter((link): link is ClientSocialLinkValue => link !== null),
  );

const legacyCompanySocialLinks = (
  company: Pick<Company, "linkedin_url" | "context_links">,
): ClientSocialLinkValue[] => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  const links: ClientSocialLinkValue[] = [];

  const add = (network: string, url?: string | null) => {
    const normalized = normalizeSocialUrl(url);
    if (!normalized) return;
    links.push({ network, url: normalized });
  };

  add("linkedin", company.linkedin_url);
  add("facebook", ctx.socialLinks?.companyFacebook);
  add("instagram", ctx.socialLinks?.companyInstagram);
  add("x", ctx.socialLinks?.companyX);

  return links;
};

const legacyContactSocialLinks = (
  contact?: Contact | null,
  contextLinks?: string[] | null,
): ClientSocialLinkValue[] => {
  const ctx = parseLbsClientContextLinks(contextLinks);
  const links: ClientSocialLinkValue[] = [];

  const add = (network: string, url?: string | null) => {
    const normalized = normalizeSocialUrl(url);
    if (!normalized) return;
    links.push({ network, url: normalized });
  };

  add("linkedin", contact?.linkedin_url);
  add("facebook", ctx.socialLinks?.contactFacebook);
  add("instagram", ctx.socialLinks?.contactInstagram);
  add("x", ctx.socialLinks?.contactX);

  return links;
};

export const collectCompanySocialLinks = (
  company: Pick<Company, "linkedin_url" | "context_links">,
): ClientSocialLinkValue[] => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  const fromJson = ctx.companySocialLinks ?? [];
  const merged = fromJson.length > 0 ? fromJson : legacyCompanySocialLinks(company);
  return dedupeSocialLinks(
    merged.map((link) => ({
      network: resolveSocialNetwork(link),
      url: normalizeSocialUrl(link.url),
    })),
  );
};

export const collectContactSocialLinks = (
  contact?: Contact | null,
  contextLinks?: string[] | null,
): ClientSocialLinkValue[] => {
  const ctx = parseLbsClientContextLinks(contextLinks);
  const fromJson = ctx.contactSocialLinks ?? [];
  const merged = fromJson.length > 0 ? fromJson : legacyContactSocialLinks(contact, contextLinks);
  return dedupeSocialLinks(
    merged.map((link) => ({
      network: resolveSocialNetwork(link),
      url: normalizeSocialUrl(link.url),
    })),
  );
};

export const collectBusinessSocialLinks = (
  company: Pick<Company, "linkedin_url" | "context_links">,
): ClientSocialLinkValue[] => collectCompanySocialLinks(company);

export const collectPrimaryContactSocialLinks = (
  company: Pick<Company, "context_links">,
  primaryContact?: Contact | null,
): ClientSocialLinkValue[] =>
  collectContactSocialLinks(primaryContact, company.context_links);

export const findLinkedinUrl = (links: ClientSocialLinkValue[]) =>
  links.find((link) => resolveSocialNetwork(link) === "linkedin")?.url ?? null;
