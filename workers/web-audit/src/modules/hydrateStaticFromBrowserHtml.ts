import * as cheerio from "cheerio";
import type { StaticAnalysisResult } from "../types.js";
import { resolvePageArchitecture } from "./mergeSeoAnalysis.js";
import { analyzeExpandedSeo } from "./expandedSeoAnalysis.js";
import { detectTechnologies } from "./detectTechnologies.js";
import { extractSocialLinks } from "./extractSocialLinks.js";
import { extractPageLinks } from "./extractPageLinks.js";
import { analyzeCrawlFiles, buildAiSeoChecklist } from "./crawlFilesAnalysis.js";
import { analyzeComplianceSignals } from "./complianceAnalysis.js";
import {
  analyzeExtendedCrawlFiles,
  extractHtmlResourceHints,
} from "./extendedCrawlFiles.js";

const originOf = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
};

/** Rellena static_json desde HTML obtenido con Chrome (fallback WAF/bot block). */
export const hydrateStaticFromBrowserHtml = async (
  staticResult: StaticAnalysisResult,
  params: {
    html: string;
    finalUrl: string;
    signal: AbortSignal;
  },
) => {
  const { html, finalUrl, signal } = params;
  if (!html.trim()) return false;

  staticResult.finalUrl = finalUrl;
  staticResult.httpStatus = staticResult.httpStatus ?? 200;
  staticResult.htmlBytes = Buffer.byteLength(html, "utf8");
  staticResult.sourceHtml = html.slice(0, 400_000);

  const $ = cheerio.load(html);
  staticResult.title = $("title").first().text().trim() || null;
  staticResult.metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  staticResult.h1Count = $("h1").length;
  staticResult.h1Text = $("h1").first().text().trim() || null;
  staticResult.canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  staticResult.viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;

  staticResult.og = {};
  $('meta[property^="og:"]').each((_index, element) => {
    const property = $(element).attr("property");
    const content = $(element).attr("content");
    if (property && content) staticResult.og[property] = content;
  });

  staticResult.twitter = {};
  $('meta[name^="twitter:"]').each((_index, element) => {
    const name = $(element).attr("name");
    const content = $(element).attr("content");
    if (name && content) staticResult.twitter[name] = content;
  });

  const pageOrigin = originOf(finalUrl);
  staticResult.imagesWithoutAlt = 0;
  staticResult.totalImages = 0;
  staticResult.imagesMissingAlt = [];

  $("img").each((_index, element) => {
    staticResult.totalImages += 1;
    const alt = $(element).attr("alt");
    if (!alt || !alt.trim()) {
      staticResult.imagesWithoutAlt += 1;
      if (staticResult.imagesMissingAlt.length < 12) {
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
        staticResult.imagesMissingAlt.push({ src: resolvedSrc, filename });
      }
    }
  });

  staticResult.socialLinks = extractSocialLinks($, pageOrigin);
  staticResult.staticPageLinks = extractPageLinks($, pageOrigin);
  staticResult.totalPageLinks = staticResult.staticPageLinks.length;

  staticResult.technologies = await detectTechnologies({
    url: finalUrl,
    html,
    statusCode: 200,
    headers: staticResult.responseHeaders ?? {},
  });

  staticResult.pageArchitecture = resolvePageArchitecture(
    html,
    staticResult.technologies,
  );

  staticResult.expandedSeo = analyzeExpandedSeo($, {
    title: staticResult.title,
    metaDescription: staticResult.metaDescription,
    canonical: staticResult.canonical,
    h1Count: staticResult.h1Count,
    h1Text: staticResult.h1Text,
  });
  staticResult.expandedSeo.analysisMode = "rendered";
  staticResult.expandedSeo.pageArchitecture = staticResult.pageArchitecture;
  staticResult.expandedSeo.auditNote =
    "El servidor bloqueó el fetch automático (WAF/bot protection). SEO extraído del navegador Chrome del audit.";

  const origin = originOf(finalUrl);
  const hints = extractHtmlResourceHints(origin, $);
  staticResult.complianceSignals = analyzeComplianceSignals($, origin, html);

  staticResult.crawlFiles = await analyzeCrawlFiles(origin, signal, {
    hasStructuredData: Boolean(staticResult.expandedSeo?.hasStructuredData),
    structuredDataTypes:
      staticResult.expandedSeo?.structuredData?.map((item) => item.type) ?? [],
    openGraphComplete: Boolean(staticResult.expandedSeo?.openGraph.complete),
    titleOk: staticResult.expandedSeo?.titleLengthStatus === "ok",
    metaOk: staticResult.expandedSeo?.metaDescriptionLengthStatus === "ok",
    hasH1: staticResult.h1Count >= 1,
    socialLinkCount: staticResult.socialLinks.length,
    hasViewport: Boolean(staticResult.viewport),
    brokenLinkCount: staticResult.brokenLinkCount ?? 0,
    imagesWithoutAlt: staticResult.imagesWithoutAlt,
  });

  staticResult.crawlFiles.extended = await analyzeExtendedCrawlFiles(
    origin,
    signal,
    hints,
  );

  staticResult.crawlFiles.aiSeoChecklist = buildAiSeoChecklist({
    robots: staticResult.crawlFiles.robots,
    sitemap: staticResult.crawlFiles.sitemap,
    llmsTxt: staticResult.crawlFiles.llmsTxt,
    securityTxt: staticResult.crawlFiles.securityTxt,
    siteInfra: staticResult.crawlFiles.siteInfra,
    extended: staticResult.crawlFiles.extended,
    complianceSignals: staticResult.complianceSignals,
    hasStructuredData: Boolean(staticResult.expandedSeo?.hasStructuredData),
    hasLocalBusinessSchema: (staticResult.expandedSeo?.structuredData ?? []).some(
      (item) => /localbusiness|organization|website/i.test(item.type),
    ),
    openGraphComplete: Boolean(staticResult.expandedSeo?.openGraph.complete),
    titleOk: staticResult.expandedSeo?.titleLengthStatus === "ok",
    metaOk: staticResult.expandedSeo?.metaDescriptionLengthStatus === "ok",
    hasH1: staticResult.h1Count >= 1,
    socialLinkCount: staticResult.socialLinks.length,
    hasViewport: Boolean(staticResult.viewport),
    brokenLinkCount: staticResult.brokenLinkCount ?? 0,
    imagesWithoutAlt: staticResult.imagesWithoutAlt,
  });

  staticResult.hasRobotsTxt = staticResult.crawlFiles.robots.found;
  staticResult.robotsTxtStatus = staticResult.crawlFiles.robots.status;
  staticResult.hasSitemap = staticResult.crawlFiles.sitemap.found;
  staticResult.sitemapStatus = staticResult.crawlFiles.sitemap.status;
  staticResult.staticFetchRecovered = true;

  return true;
};
