import type { LucideIcon } from "lucide-react";
import {
  detectSocialNetworkFromUrl,
  getSocialNetworkOption,
  normalizeSocialUrl,
} from "@/modules/clients/clientSocialLinks";
import { normalizeFlexibleUrl } from "@/modules/deals/briefFormUtils";

const BRIEF_EXTRA_NETWORKS: [RegExp, string][] = [
  [/yelp\.com/i, "yelp"],
  [/nextdoor\.com/i, "nextdoor"],
  [/google\.com\/maps|business\.google|g\.page/i, "google"],
  [/thumbtack\.com/i, "thumbtack"],
];

const BRIEF_NETWORK_LABELS: Record<string, string> = {
  yelp: "Yelp",
  nextdoor: "Nextdoor",
  google: "Google Business",
  thumbtack: "Thumbtack",
};

const BRIEF_NETWORK_TO_PLATFORM: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  yelp: "Yelp",
  nextdoor: "Nextdoor",
  google: "Google Business",
  thumbtack: "Thumbtack",
  other: "Other",
};

export const detectBriefSocialNetwork = (url?: string | null): string => {
  const normalized = normalizeSocialUrl(url).toLowerCase();
  if (!normalized) return "other";

  for (const [pattern, network] of BRIEF_EXTRA_NETWORKS) {
    if (pattern.test(normalized)) return network;
  }

  return detectSocialNetworkFromUrl(url);
};

export const getBriefSocialDisplay = (
  url?: string | null,
): { label: string; Icon: LucideIcon; networkId: string } => {
  const networkId = detectBriefSocialNetwork(url);
  const customLabel = BRIEF_NETWORK_LABELS[networkId];
  if (customLabel) {
    return {
      label: customLabel,
      Icon: getSocialNetworkOption("other").Icon,
      networkId,
    };
  }

  const option = getSocialNetworkOption(networkId);
  return { label: option.label, Icon: option.Icon, networkId };
};

export const extractBriefSocialUrl = (entry: string) => {
  const pipeIndex = entry.indexOf("|");
  if (pipeIndex === -1) return entry.trim();
  return entry.slice(pipeIndex + 1).trim();
};

export const parseBriefSocialUrls = (value: unknown): string[] => {
  const rows = Array.isArray(value) ? value.map(String) : [];
  if (rows.length === 0) return [""];
  return rows.map(extractBriefSocialUrl);
};

export const serializeBriefSocialUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const networkId = detectBriefSocialNetwork(trimmed);
  const platform =
    BRIEF_NETWORK_TO_PLATFORM[networkId] ?? BRIEF_NETWORK_TO_PLATFORM.other;
  return `${platform}|${normalizeFlexibleUrl(trimmed)}`;
};

export const serializeBriefSocialUrls = (urls: string[]) =>
  urls.map((url) => (url.trim() ? serializeBriefSocialUrl(url) : ""));

/** Drop blank rows before persisting to the database. */
export const cleanStoredBriefSocialLinks = (value: unknown): string[] =>
  (Array.isArray(value) ? value.map(String) : [])
    .map((entry) => {
      const url = extractBriefSocialUrl(entry);
      if (!url.trim()) return "";
      return entry.includes("|") ? entry : serializeBriefSocialUrl(url);
    })
    .filter((entry) => Boolean(extractBriefSocialUrl(entry).trim()));

export const detectSocialIconFromBriefEntry = (value: string): LucideIcon =>
  getBriefSocialDisplay(extractBriefSocialUrl(value)).Icon;
