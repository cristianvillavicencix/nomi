import type { CheerioAPI } from "cheerio";

export type PageLinkFound = {
  url: string;
  text?: string | null;
  isInternal: boolean;
};

const SKIP_SCHEMES = /^(mailto:|tel:|javascript:|#)/i;

const isHttpUrl = (href: string) => /^https?:\/\//i.test(href);

export const createPageLinkCollector = (pageOrigin: string) => {
  const found: PageLinkFound[] = [];
  const seen = new Set<string>();
  let pageHost = "";

  try {
    pageHost = new URL(pageOrigin).hostname.replace(/^www\./, "");
  } catch {
    pageHost = "";
  }

  const push = (rawHref: string, text?: string | null) => {
    const trimmed = rawHref.trim();
    if (!trimmed || SKIP_SCHEMES.test(trimmed)) return;

    let abs = trimmed;
    try {
      abs = new URL(trimmed, pageOrigin).href;
    } catch {
      return;
    }

    if (!isHttpUrl(abs)) return;

    const key = abs.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    let isInternal = false;
    try {
      const host = new URL(abs).hostname.replace(/^www\./, "");
      isInternal = Boolean(pageHost && host === pageHost);
    } catch {
      isInternal = false;
    }

    found.push({
      url: abs,
      text: text?.trim().slice(0, 120) || null,
      isInternal,
    });
  };

  const addFromCheerio = ($: CheerioAPI) => {
    $("a[href]").each((_index, element) => {
      const href = $(element).attr("href");
      const text = $(element).text();
      const aria = $(element).attr("aria-label");
      if (href) push(href, text || aria);
    });
  };

  const addFromAnchors = (
    anchors: Array<{ href: string; text?: string | null }>,
  ) => {
    for (const anchor of anchors) {
      push(anchor.href, anchor.text);
    }
  };

  return { push, addFromCheerio, addFromAnchors, getResults: () => found };
};

export const extractPageLinks = (
  $: CheerioAPI,
  pageOrigin: string,
): PageLinkFound[] => {
  const collector = createPageLinkCollector(pageOrigin);
  collector.addFromCheerio($);
  return collector.getResults();
};

export const mergePageLinks = (
  pageOrigin: string,
  ...groups: PageLinkFound[][]
): PageLinkFound[] => {
  const collector = createPageLinkCollector(pageOrigin);
  for (const group of groups) {
    collector.addFromAnchors(
      group.map((link) => ({ href: link.url, text: link.text })),
    );
  }
  return collector.getResults();
};
