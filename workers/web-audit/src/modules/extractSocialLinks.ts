import type { CheerioAPI } from "cheerio";

export type SocialLinkFound = {
  network: string;
  url: string;
  label?: string | null;
};

const HOST_PATTERNS: Array<[RegExp, string]> = [
  [/linkedin\.com/i, "linkedin"],
  [/facebook\.com|fb\.com/i, "facebook"],
  [/instagram\.com/i, "instagram"],
  [/twitter\.com|x\.com/i, "x"],
  [/youtube\.com|youtu\.be/i, "youtube"],
  [/tiktok\.com/i, "tiktok"],
  [/pinterest\.com/i, "pinterest"],
  [/threads\.net/i, "threads"],
  [/whatsapp\.com|wa\.me/i, "whatsapp"],
];

const SHARE_PATH =
  /\/sharer|\/share\?|\/intent\/|\/dialog\/|\/plugins\/|\/tr\?/i;

const detectNetwork = (url: string): string | null => {
  let host = "";
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    path = parsed.pathname;
  } catch {
    return null;
  }

  if (
    host === "x.com" ||
    host === "twitter.com" ||
    host.endsWith(".twitter.com")
  ) {
    if (SHARE_PATH.test(path)) return null;
    return "x";
  }

  for (const [pattern, network] of HOST_PATTERNS) {
    if (network === "x") continue;
    if (pattern.test(host) || pattern.test(url.toLowerCase())) {
      if (SHARE_PATH.test(path)) return null;
      return network;
    }
  }
  return null;
};

type UrlCandidate = { url: string; label?: string | null };

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

const collectSameAs = (value: unknown, out: string[]) => {
  if (!value) return;
  if (typeof value === "string") {
    if (value.startsWith("http")) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSameAs(item, out);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.sameAs) collectSameAs(record.sameAs, out);
    if (record["@graph"]) collectSameAs(record["@graph"], out);
  }
};

const collectUrlsFromJson = (value: unknown, out: UrlCandidate[]) => {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) out.push({ url: value });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrlsFromJson(item, out);
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.link === "string" && /^https?:\/\//i.test(record.link)) {
      out.push({
        url: record.link,
        label: typeof record.name === "string" ? record.name : null,
      });
    }
    if (typeof record.url === "string" && /^https?:\/\//i.test(record.url)) {
      out.push({
        url: record.url,
        label: typeof record.name === "string" ? record.name : null,
      });
    }
    for (const nested of Object.values(record)) {
      collectUrlsFromJson(nested, out);
    }
  }
};

import { parseEmbeddedJsonPayloads } from "./embeddedAppPayloads.js";

export { parseEmbeddedJsonPayloads } from "./embeddedAppPayloads.js";

const sortSocialLinks = (found: SocialLinkFound[]) => {
  const order = HOST_PATTERNS.map(([, id]) => id);
  return found.sort(
    (a, b) => order.indexOf(a.network) - order.indexOf(b.network),
  );
};

export const createSocialLinkCollector = (pageOrigin: string) => {
  const found: SocialLinkFound[] = [];
  const seen = new Set<string>();
  let pageHost = "";

  try {
    pageHost = new URL(pageOrigin).hostname.replace(/^www\./, "");
  } catch {
    pageHost = "";
  }

  const push = (rawUrl: string, label?: string | null) => {
    const trimmed = rawUrl.trim();
    if (
      !trimmed ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("javascript:")
    ) {
      return;
    }

    let abs = trimmed;
    try {
      abs = new URL(trimmed, pageOrigin).href;
    } catch {
      return;
    }

    const network = detectNetwork(abs);
    if (!network) return;

    try {
      const host = new URL(abs).hostname.replace(/^www\./, "");
      if (pageHost && host === pageHost) return;
    } catch {
      return;
    }

    const key = `${network}:${abs.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    found.push({
      network,
      url: abs,
      label: label?.trim() || null,
    });
  };

  const addFromCheerio = ($: CheerioAPI) => {
    $("a[href]").each((_index, element) => {
      const href = $(element).attr("href");
      const text = $(element).text();
      const aria = $(element).attr("aria-label");
      if (href) push(href, text || aria);
    });

    $('script[type="application/ld+json"]').each((_index, element) => {
      const raw = $(element).html();
      if (!raw) return;
      try {
        const json = JSON.parse(raw) as unknown;
        const sameAs: string[] = [];
        collectSameAs(json, sameAs);
        for (const url of sameAs) push(url);
      } catch {
        // ignore invalid JSON-LD
      }
    });

    for (const payload of parseEmbeddedJsonPayloads($)) {
      const candidates: UrlCandidate[] = [];
      collectUrlsFromJson(payload, candidates);
      for (const candidate of candidates) {
        push(candidate.url, candidate.label);
      }
    }
  };

  return {
    push,
    addFromCheerio,
    getResults: () => sortSocialLinks(found),
  };
};

export const extractSocialLinks = (
  $: CheerioAPI,
  pageOrigin: string,
): SocialLinkFound[] => {
  const collector = createSocialLinkCollector(pageOrigin);
  collector.addFromCheerio($);
  return collector.getResults();
};

export const mergeSocialLinks = (
  pageOrigin: string,
  ...groups: SocialLinkFound[][]
): SocialLinkFound[] => {
  const collector = createSocialLinkCollector(pageOrigin);
  for (const group of groups) {
    for (const link of group) {
      collector.push(link.url, link.label);
    }
  }
  return collector.getResults();
};
