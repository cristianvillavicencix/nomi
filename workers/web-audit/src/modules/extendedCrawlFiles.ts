import type { CheerioAPI } from "cheerio";
import type { CrawlFileSnapshot, CrawlFilesFetchers } from "./crawlFilesAnalysis.js";
import {
  resolveCrawlResource,
  type CrawlFileFetcher,
} from "./crawlResourceResolver.js";
import { config } from "../config.js";

export type WebManifestAnalysis = CrawlFileSnapshot & {
  hasName: boolean;
  hasIcons: boolean;
};

export type RssFeedAnalysis = CrawlFileSnapshot & {
  feedType: "rss" | "atom" | null;
};

export type ExtendedCrawlFiles = {
  humansTxt: CrawlFileSnapshot;
  adsTxt: CrawlFileSnapshot;
  webManifest: WebManifestAnalysis;
  rssFeed: RssFeedAnalysis;
  favicon: CrawlFileSnapshot;
  appleTouchIcon: CrawlFileSnapshot;
};

export type HtmlResourceHints = {
  manifestUrls: string[];
  rssUrls: string[];
  faviconUrls: string[];
  appleTouchIconUrls: string[];
};

const emptySnap = (url: string): CrawlFileSnapshot => ({
  url,
  status: null,
  fetchStatus: null,
  browserStatus: null,
  access: "missing",
  source: "fetch",
  content: null,
  contentTruncated: false,
  found: false,
});

const snapshotFrom = (
  resolved: Awaited<ReturnType<typeof resolveCrawlResource>>,
): CrawlFileSnapshot => ({
  url: resolved.url,
  status: resolved.status,
  fetchStatus: resolved.fetchStatus,
  browserStatus: resolved.browserStatus,
  access: resolved.access,
  source: resolved.source,
  content: resolved.content?.slice(0, 4000) ?? null,
  contentTruncated: (resolved.content?.length ?? 0) > 4000,
  found: resolved.found,
});

const isHumansContent = (text: string) => {
  const t = text.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return false;
  return t.length >= 3;
};

const isAdsTxtContent = (text: string) => {
  const t = text.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return false;
  return /direct|google\.com|pub-|ownerdomain|managerdomain/i.test(t) || t.includes("=");
};

const isManifestContent = (text: string) => {
  try {
    const json = JSON.parse(text) as { name?: string; icons?: unknown[] };
    return Boolean(json.name || json.icons?.length);
  } catch {
    return false;
  }
};

const isRssContent = (text: string) =>
  /<rss|<feed[\s>]/i.test(text) || /xmlns:atom/i.test(text);

const parseManifestMeta = (content: string | null) => {
  if (!content) return { hasName: false, hasIcons: false };
  try {
    const json = JSON.parse(content) as { name?: string; icons?: unknown[] };
    return {
      hasName: Boolean(json.name?.trim()),
      hasIcons: Boolean(json.icons?.length),
    };
  } catch {
    return { hasName: false, hasIcons: false };
  }
};

const parseFeedType = (content: string | null): RssFeedAnalysis["feedType"] => {
  if (!content) return null;
  if (/<feed[\s>]/i.test(content)) return "atom";
  if (/<rss/i.test(content)) return "rss";
  return null;
};

const normalizeFetchers = (
  fetchers: CrawlFilesFetchers,
): { datacenter?: CrawlFileFetcher; browser?: CrawlFileFetcher } =>
  typeof fetchers === "function" ? { datacenter: fetchers } : fetchers;

const defaultFetcher: CrawlFileFetcher = async (url, signal) => {
  try {
    const response = await fetch(url, {
      signal,
      redirect: "follow",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/plain,text/html,application/xml,application/json,*/*",
      },
    });
    return { status: response.status, text: await response.text() };
  } catch {
    return null;
  }
};

const resolveFirst = async (
  urls: string[],
  signal: AbortSignal,
  fetchers: { datacenter?: CrawlFileFetcher; browser?: CrawlFileFetcher },
  validator: (text: string) => boolean,
): Promise<CrawlFileSnapshot> => {
  for (const url of urls) {
    const resolved = await resolveCrawlResource(url, signal, fetchers, validator);
    if (resolved.found) return snapshotFrom(resolved);
    if (resolved.access === "blocked") return snapshotFrom(resolved);
  }
  return emptySnap(urls[0] ?? "");
};

export const extractHtmlResourceHints = (
  origin: string,
  $: CheerioAPI,
): HtmlResourceHints => {
  const manifestUrls = new Set<string>();
  const rssUrls = new Set<string>();
  const faviconUrls = new Set<string>();
  const appleTouchIconUrls = new Set<string>();

  const add = (set: Set<string>, href: string | undefined) => {
    if (!href?.trim()) return;
    try {
      set.add(new URL(href.trim(), origin).href);
    } catch {
      set.add(href.trim());
    }
  };

  $('link[rel="manifest"]').each((_i, el) => {
    add(manifestUrls, $(el).attr("href"));
  });
  $('link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]').each(
    (_i, el) => {
      add(rssUrls, $(el).attr("href"));
    },
  );
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_i, el) => {
    add(faviconUrls, $(el).attr("href"));
  });
  $('link[rel="apple-touch-icon"]').each((_i, el) => {
    add(appleTouchIconUrls, $(el).attr("href"));
  });

  return {
    manifestUrls: [...manifestUrls],
    rssUrls: [...rssUrls],
    faviconUrls: [...faviconUrls],
    appleTouchIconUrls: [...appleTouchIconUrls],
  };
};

export const analyzeExtendedCrawlFiles = async (
  origin: string,
  signal: AbortSignal,
  hints: HtmlResourceHints = {
    manifestUrls: [],
    rssUrls: [],
    faviconUrls: [],
    appleTouchIconUrls: [],
  },
  fetchers: CrawlFilesFetchers = defaultFetcher,
): Promise<ExtendedCrawlFiles> => {
  const resolvedFetchers = normalizeFetchers(fetchers);

  const humansTxt = await resolveFirst(
    [`${origin}/humans.txt`],
    signal,
    resolvedFetchers,
    isHumansContent,
  );

  const adsTxt = await resolveFirst(
    [`${origin}/ads.txt`, `${origin}/app-ads.txt`],
    signal,
    resolvedFetchers,
    isAdsTxtContent,
  );

  const manifestCandidates = [
    ...hints.manifestUrls,
    `${origin}/manifest.webmanifest`,
    `${origin}/site.webmanifest`,
    `${origin}/manifest.json`,
  ];
  const manifestResolved = await resolveFirst(
    [...new Set(manifestCandidates)],
    signal,
    resolvedFetchers,
    isManifestContent,
  );
  const manifestMeta = parseManifestMeta(manifestResolved.content);
  const webManifest: WebManifestAnalysis = {
    ...manifestResolved,
    ...manifestMeta,
  };

  const rssCandidates = [
    ...hints.rssUrls,
    `${origin}/feed/`,
    `${origin}/feed`,
    `${origin}/rss.xml`,
    `${origin}/atom.xml`,
    `${origin}/feed.xml`,
  ];
  const rssResolved = await resolveFirst(
    [...new Set(rssCandidates)],
    signal,
    resolvedFetchers,
    isRssContent,
  );
  const rssFeed: RssFeedAnalysis = {
    ...rssResolved,
    feedType: parseFeedType(rssResolved.content),
  };

  const faviconCandidates = [
    ...hints.faviconUrls,
    `${origin}/favicon.ico`,
  ];
  const favicon = await resolveFirst(
    [...new Set(faviconCandidates)],
    signal,
    resolvedFetchers,
    (text) => text.length > 20 || text.includes("PNG") || text.includes("ICO"),
  );

  const appleCandidates = [
    ...hints.appleTouchIconUrls,
    `${origin}/apple-touch-icon.png`,
    `${origin}/apple-touch-icon-precomposed.png`,
  ];
  const appleTouchIcon = await resolveFirst(
    [...new Set(appleCandidates)],
    signal,
    resolvedFetchers,
    (text) => text.length > 20 || text.includes("PNG"),
  );

  return {
    humansTxt,
    adsTxt,
    webManifest,
    rssFeed,
    favicon,
    appleTouchIcon,
  };
};

const pickExtendedSnap = <T extends CrawlFileSnapshot>(a: T, b: T): T => {
  if (b.found) {
    return {
      ...b,
      fetchStatus: a.fetchStatus ?? b.fetchStatus,
      source: a.found && b.found ? "merged" : b.source,
    } as T;
  }
  if (a.found) return a;
  if (b.access === "blocked" || a.access === "blocked") {
    return {
      ...b,
      fetchStatus: a.fetchStatus ?? b.fetchStatus,
      browserStatus: b.browserStatus ?? a.browserStatus,
      access: "blocked",
    } as T;
  }
  return b.status != null ? b : a;
};

export const mergeExtendedCrawlFiles = (
  current?: ExtendedCrawlFiles,
  browser?: ExtendedCrawlFiles,
): ExtendedCrawlFiles | undefined => {
  if (!current && !browser) return undefined;
  if (!browser) return current;
  if (!current) return browser;

  const webManifest = {
    ...pickExtendedSnap(current.webManifest, browser.webManifest),
    hasName: browser.webManifest.hasName || current.webManifest.hasName,
    hasIcons: browser.webManifest.hasIcons || current.webManifest.hasIcons,
  };

  const rssFeed = {
    ...pickExtendedSnap(current.rssFeed, browser.rssFeed),
    feedType: browser.rssFeed.feedType ?? current.rssFeed.feedType,
  };

  return {
    humansTxt: pickExtendedSnap(current.humansTxt, browser.humansTxt),
    adsTxt: pickExtendedSnap(current.adsTxt, browser.adsTxt),
    webManifest,
    rssFeed,
    favicon: pickExtendedSnap(current.favicon, browser.favicon),
    appleTouchIcon: pickExtendedSnap(
      current.appleTouchIcon,
      browser.appleTouchIcon,
    ),
  };
};
