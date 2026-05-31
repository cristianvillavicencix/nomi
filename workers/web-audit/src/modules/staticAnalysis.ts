import * as cheerio from "cheerio";
import type { StaticAnalysisResult } from "../types.js";
import { config } from "../config.js";
import { resolvePageArchitecture } from "./mergeSeoAnalysis.js";
import { analyzeExpandedSeo } from "./expandedSeoAnalysis.js";
import { detectTechnologies } from "./detectTechnologies.js";
import { extractSocialLinks } from "./extractSocialLinks.js";
import { extractPageLinks } from "./extractPageLinks.js";
import {
  analyzeCrawlFiles,
  buildAiSeoChecklist,
  type CrawlFilesAnalysisResult,
} from "./crawlFilesAnalysis.js";
import { analyzeDomainInfra } from "./domainInfraAnalysis.js";
import { analyzeComplianceSignals } from "./complianceAnalysis.js";
import {
  analyzeExtendedCrawlFiles,
  extractHtmlResourceHints,
} from "./extendedCrawlFiles.js";

const BOT_BLOCK_STATUSES = new Set([403, 429, 503, 520, 521, 522, 523]);

const isBotBlockMessage = (message: string) =>
  /connection reset|ECONNRESET|ETIMEDOUT|blocked|captcha|cloudflare|access denied|forbidden|bot protection|net::ERR_/i.test(
    message,
  );

const fetchText = async (
  url: string,
  signal: AbortSignal,
): Promise<{
  status: number;
  text: string;
  finalUrl: string;
  headers: Record<string, string>;
}> => {
  const response = await fetch(url, {
    signal,
    redirect: "follow",
    headers: {
      "User-Agent": config.userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      "Cache-Control": "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const text = await response.text();
  return {
    status: response.status,
    text,
    finalUrl: response.url,
    headers,
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
    imagesMissingAlt: [],
    socialLinks: [],
    staticPageLinks: [],
    pageLinks: [],
    totalPageLinks: 0,
    brokenLinkCount: 0,
    checkedLinkCount: 0,
    pageImages: [],
    brokenImages: 0,
    imagesOk: 0,
    hasRobotsTxt: false,
    robotsTxtStatus: null,
    hasSitemap: false,
    sitemapStatus: null,
    expandedSeo: null,
    technologies: [],
    responseHeaders: {},
    blockedLikely: false,
    fetchError: null,
  };

  try {
    const page = await fetchText(url, signal);
    base.finalUrl = page.finalUrl;
    base.httpStatus = page.status;
    base.htmlBytes = Buffer.byteLength(page.text, "utf8");
    base.responseHeaders = page.headers;

    if (BOT_BLOCK_STATUSES.has(page.status)) {
      base.blockedLikely = true;
      base.staticFetchBlocked = true;
      base.fetchError = `HTTP ${page.status}: el servidor bloqueó el fetch automático (WAF/bot protection). El audit continuará con navegador Chrome.`;
      base.domainInfra = await analyzeDomainInfra(page.finalUrl || url, signal);
      return base;
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

    const pageOrigin = originOf(page.finalUrl || url);
    $("img").each((_index, element) => {
      base.totalImages += 1;
      const alt = $(element).attr("alt");
      if (!alt || !alt.trim()) {
        base.imagesWithoutAlt += 1;
        if (base.imagesMissingAlt.length < 12) {
          const rawSrc = $(element).attr("src")?.trim() ?? "";
          let resolvedSrc = rawSrc;
          if (rawSrc) {
            try {
              resolvedSrc = new URL(rawSrc, pageOrigin).href;
            } catch {
              resolvedSrc = rawSrc;
            }
          }
          const filename = rawSrc
            ? rawSrc.split("/").pop()?.split("?")[0] ?? null
            : null;
          base.imagesMissingAlt.push({ src: resolvedSrc, filename });
        }
      }
    });

    base.socialLinks = extractSocialLinks($, pageOrigin);
    base.staticPageLinks = extractPageLinks($, pageOrigin);
    base.totalPageLinks = base.staticPageLinks.length;

    base.technologies = await detectTechnologies({
      url: page.finalUrl || url,
      html: page.text,
      statusCode: page.status,
      headers: page.headers,
    });

    base.pageArchitecture = resolvePageArchitecture(
      page.text,
      base.technologies,
    );
    base.sourceHtml = page.text.slice(0, 400_000);

    base.expandedSeo = analyzeExpandedSeo($, {
      title: base.title,
      metaDescription: base.metaDescription,
      canonical: base.canonical,
      h1Count: base.h1Count,
      h1Text: base.h1Text,
    });
    base.expandedSeo.analysisMode = "static";
    base.expandedSeo.pageArchitecture = base.pageArchitecture;
    base.expandedSeo.auditNote =
      "Análisis preliminar en HTML inicial; se refinará con DOM renderizado si el sitio usa JavaScript.";

    const origin = originOf(page.finalUrl || url);
    const hints = extractHtmlResourceHints(origin, $);
    base.complianceSignals = analyzeComplianceSignals($, origin, page.text);

    const [crawlFiles, domainInfra, extended] = await Promise.all([
      analyzeCrawlFiles(
        origin,
        signal,
        {
          hasStructuredData: Boolean(base.expandedSeo?.hasStructuredData),
          structuredDataTypes:
            base.expandedSeo?.structuredData?.map((item) => item.type) ?? [],
          openGraphComplete: Boolean(base.expandedSeo?.openGraph.complete),
          titleOk: base.expandedSeo?.titleLengthStatus === "ok",
          metaOk: base.expandedSeo?.metaDescriptionLengthStatus === "ok",
          hasH1: base.h1Count >= 1,
          socialLinkCount: base.socialLinks.length,
          hasViewport: Boolean(base.viewport),
          brokenLinkCount: 0,
          imagesWithoutAlt: base.imagesWithoutAlt,
        },
        undefined,
        page.headers,
      ),
      analyzeDomainInfra(page.finalUrl || url, signal),
      analyzeExtendedCrawlFiles(origin, signal, hints),
    ]);

    crawlFiles.extended = extended;
    crawlFiles.aiSeoChecklist = buildAiSeoChecklist({
      robots: crawlFiles.robots,
      sitemap: crawlFiles.sitemap,
      llmsTxt: crawlFiles.llmsTxt,
      securityTxt: crawlFiles.securityTxt,
      siteInfra: crawlFiles.siteInfra,
      extended,
      complianceSignals: base.complianceSignals,
      hasStructuredData: Boolean(base.expandedSeo?.hasStructuredData),
      hasLocalBusinessSchema: (base.expandedSeo?.structuredData ?? []).some(
        (item) => /localbusiness|organization|website/i.test(item.type),
      ),
      openGraphComplete: Boolean(base.expandedSeo?.openGraph.complete),
      titleOk: base.expandedSeo?.titleLengthStatus === "ok",
      metaOk: base.expandedSeo?.metaDescriptionLengthStatus === "ok",
      hasH1: base.h1Count >= 1,
      socialLinkCount: base.socialLinks.length,
      hasViewport: Boolean(base.viewport),
      brokenLinkCount: 0,
      imagesWithoutAlt: base.imagesWithoutAlt,
    });

    base.crawlFiles = crawlFiles;
    base.domainInfra = domainInfra;
    base.hasRobotsTxt = crawlFiles.robots.found;
    base.robotsTxtStatus = crawlFiles.robots.status;
    base.hasSitemap = crawlFiles.sitemap.found;
    base.sitemapStatus = crawlFiles.sitemap.status;

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
export { buildAiSeoChecklist } from "./crawlFilesAnalysis.js";
export type { CrawlFilesAnalysisResult } from "./crawlFilesAnalysis.js";

export const refreshAiSeoChecklist = (staticResult: StaticAnalysisResult) => {
  if (!staticResult.crawlFiles) return;

  const seo = staticResult.expandedSeo;
  const types = seo?.structuredData?.map((item) => item.type) ?? [];

  staticResult.crawlFiles.aiSeoChecklist = buildAiSeoChecklist({
    robots: staticResult.crawlFiles.robots,
    sitemap: staticResult.crawlFiles.sitemap,
    llmsTxt: staticResult.crawlFiles.llmsTxt,
    securityTxt: staticResult.crawlFiles.securityTxt,
    siteInfra: staticResult.crawlFiles.siteInfra,
    extended: staticResult.crawlFiles.extended,
    complianceSignals: staticResult.complianceSignals,
    hasStructuredData: Boolean(seo?.hasStructuredData),
    hasLocalBusinessSchema: types.some((type) =>
      /localbusiness|organization|website/i.test(type),
    ),
    openGraphComplete: Boolean(seo?.openGraph.complete),
    titleOk: seo?.titleLengthStatus === "ok",
    metaOk: seo?.metaDescriptionLengthStatus === "ok",
    hasH1: (staticResult.h1Count ?? 0) >= 1,
    socialLinkCount: staticResult.socialLinks?.length ?? 0,
    hasViewport: Boolean(staticResult.viewport),
    brokenLinkCount: staticResult.brokenLinkCount ?? 0,
    imagesWithoutAlt: staticResult.imagesWithoutAlt ?? 0,
  });
};
