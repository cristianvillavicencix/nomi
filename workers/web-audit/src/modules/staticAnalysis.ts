import * as cheerio from "cheerio";
import type { StaticAnalysisResult } from "../types.js";
import { config } from "../config.js";

const BOT_BLOCK_STATUSES = new Set([403, 429, 503, 520, 521, 522, 523]);

const isBotBlockMessage = (message: string) =>
  /connection reset|ECONNRESET|ETIMEDOUT|blocked|captcha|cloudflare|access denied|forbidden|bot protection|net::ERR_/i.test(
    message,
  );

const fetchText = async (
  url: string,
  signal: AbortSignal,
): Promise<{ status: number; text: string; finalUrl: string }> => {
  const response = await fetch(url, {
    signal,
    redirect: "follow",
    headers: {
      "User-Agent": config.userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const text = await response.text();
  return {
    status: response.status,
    text,
    finalUrl: response.url,
  };
};

const originOf = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
};

export class StaticAnalysisError extends Error {
  constructor(
    message: string,
    readonly code: "bot_protection" | "timeout" | "fetch_failed",
  ) {
    super(message);
    this.name = "StaticAnalysisError";
  }
}

export const runStaticAnalysis = async (
  url: string,
  signal: AbortSignal,
): Promise<StaticAnalysisResult> => {
  const base: StaticAnalysisResult = {
    url,
    finalUrl: null,
    httpStatus: null,
    htmlBytes: 0,
    title: null,
    metaDescription: null,
    h1Count: 0,
    h1Text: null,
    canonical: null,
    viewport: null,
    og: {},
    twitter: {},
    imagesWithoutAlt: 0,
    totalImages: 0,
    hasRobotsTxt: false,
    robotsTxtStatus: null,
    hasSitemap: false,
    sitemapStatus: null,
    blockedLikely: false,
    fetchError: null,
  };

  try {
    const page = await fetchText(url, signal);
    base.finalUrl = page.finalUrl;
    base.httpStatus = page.status;
    base.htmlBytes = Buffer.byteLength(page.text, "utf8");

    if (BOT_BLOCK_STATUSES.has(page.status)) {
      base.blockedLikely = true;
      throw new StaticAnalysisError(
        `El sitio respondió HTTP ${page.status} (posible bot protection o WAF).`,
        "bot_protection",
      );
    }

    const $ = cheerio.load(page.text);
    base.title = $("title").first().text().trim() || null;
    base.metaDescription =
      $('meta[name="description"]').attr("content")?.trim() || null;
    base.h1Count = $("h1").length;
    base.h1Text = $("h1").first().text().trim() || null;
    base.canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
    base.viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;

    $('meta[property^="og:"]').each((_index, element) => {
      const property = $(element).attr("property");
      const content = $(element).attr("content");
      if (property && content) base.og[property] = content;
    });

    $('meta[name^="twitter:"]').each((_index, element) => {
      const name = $(element).attr("name");
      const content = $(element).attr("content");
      if (name && content) base.twitter[name] = content;
    });

    $("img").each((_index, element) => {
      base.totalImages += 1;
      const alt = $(element).attr("alt");
      if (!alt || !alt.trim()) base.imagesWithoutAlt += 1;
    });

    const origin = originOf(page.finalUrl || url);

    try {
      const robots = await fetchText(`${origin}/robots.txt`, signal);
      base.robotsTxtStatus = robots.status;
      base.hasRobotsTxt = robots.status >= 200 && robots.status < 400;
    } catch {
      base.hasRobotsTxt = false;
    }

    try {
      const sitemap = await fetch(`${origin}/sitemap.xml`, {
        signal,
        headers: { "User-Agent": config.userAgent },
      });
      base.sitemapStatus = sitemap.status;
      base.hasSitemap = sitemap.status >= 200 && sitemap.status < 400;
    } catch {
      base.hasSitemap = false;
    }

    return base;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    base.fetchError = message;

    if (cause instanceof StaticAnalysisError) {
      throw cause;
    }

    if (signal.aborted) {
      throw new StaticAnalysisError(
        "El análisis estático excedió el tiempo límite.",
        "timeout",
      );
    }

    if (isBotBlockMessage(message)) {
      throw new StaticAnalysisError(
        `No se pudo cargar el sitio (${message}). Posible bot protection desde el datacenter del worker.`,
        "bot_protection",
      );
    }

    throw new StaticAnalysisError(
      `Falló el análisis estático: ${message}`,
      "fetch_failed",
    );
  }
};

export { isBotBlockMessage };
