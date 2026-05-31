import puppeteer from "puppeteer-core";
import { AxePuppeteer } from "@axe-core/puppeteer";
import type { Result, AxeResults } from "axe-core";
import type { AuditChrome } from "./sharedChrome.js";
import type { AuditFindingInput } from "../types.js";
import type { SocialLinkFound } from "./extractSocialLinks.js";
import { extractRenderedSocialLinks } from "./extractRenderedSocialLinks.js";
import type { PageLinkFound } from "./extractPageLinks.js";
import {
  extractRenderedPageContent,
  type PageImageFound,
} from "./extractRenderedPageContent.js";
import {
  extractRenderedSeoSignals,
  type RenderedSeoSignals,
} from "./extractRenderedSeo.js";
import { waitForPageContent } from "./waitForPageContent.js";
import {
  analyzeCrawlFiles,
  createBrowserCrawlFileFetcher,
  type CrawlFilesAnalysisResult,
} from "./crawlFilesAnalysis.js";
import {
  analyzeExtendedCrawlFiles,
  type HtmlResourceHints,
} from "./extendedCrawlFiles.js";

export type AxeAuditResult = {
  axeJson: Record<string, unknown>;
  findings: AuditFindingInput[];
  violationCount: number;
  socialLinks: SocialLinkFound[];
  pageLinks: PageLinkFound[];
  pageImages: PageImageFound[];
  renderedSeo: RenderedSeoSignals | null;
  browserCrawlFiles: CrawlFilesAnalysisResult | null;
};

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

const mapAxeImpactToSeverity = (
  impact: string | null | undefined,
): AuditFindingInput["severity"] => {
  switch (impact) {
    case "critical":
    case "serious":
      return "critico";
    case "moderate":
      return "importante";
    default:
      return "nice-to-have";
  }
};

const violationTitle = (violation: Result) =>
  violation.help?.trim() ||
  violation.description?.trim() ||
  violation.id ||
  "Accessibility issue";

const violationDescription = (violation: Result) => {
  const nodes = violation.nodes?.length ?? 0;
  const base = violation.description?.trim() ?? "";
  return nodes > 0 ? `${base} (${nodes} element${nodes === 1 ? "" : "s"} affected)`.trim() : base;
};

export const mapAxeViolationsToFindings = (
  violations: Result[],
  startOrder = 200,
): AuditFindingInput[] => {
  const sorted = [...violations].sort(
    (a, b) =>
      (IMPACT_ORDER[a.impact ?? "minor"] ?? 99) -
      (IMPACT_ORDER[b.impact ?? "minor"] ?? 99),
  );

  return sorted.slice(0, 25).map((violation, index) => {
    const nodes = violation.nodes ?? [];
    const locations = nodes
      .slice(0, 3)
      .map((node) => {
        const target = node.target?.join(" ") ?? "";
        const snippet = node.html?.replace(/\s+/g, " ").trim().slice(0, 100);
        return snippet
          ? `${target || "elemento"} → ${snippet}`
          : target || null;
      })
      .filter(Boolean);

    const locationText =
      locations.length > 0
        ? ` Dónde: ${locations.join(" · ")}`
        : "";

    return {
      category: "a11y",
      severity: mapAxeImpactToSeverity(violation.impact),
      source: "axe",
      source_id: violation.id,
      title: violationTitle(violation),
      description: `${violationDescription(violation) || ""}${locationText}`.trim() || null,
      recommendation: violation.helpUrl
        ? `${violation.help ?? "Corrige esta regla de accesibilidad."} Guía: ${violation.helpUrl}`
        : violation.help ?? "Corrige esta regla de accesibilidad en el HTML/CSS del sitio.",
      metric_key: `axe:${violation.id}`,
      metric_value: violation.impact ?? null,
      display_order: startOrder + index,
    };
  });
};

const summarizeAxeJson = (results: AxeResults): Record<string, unknown> => ({
  url: results.url,
  timestamp: results.timestamp,
  testEngine: results.testEngine,
  testRunner: results.testRunner,
  violationCount: results.violations.length,
  incompleteCount: results.incomplete.length,
  passesCount: results.passes.length,
  violations: results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes?.map((n) => ({
      html: n.html?.slice(0, 200),
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  })),
});

/**
 * Runs axe-core on the page via puppeteer-core connected to the same Chromium
 * instance Lighthouse used (CDP). Does NOT launch a second browser.
 */
export const runAxeAccessibility = async (
  url: string,
  chrome: AuditChrome,
  signal: AbortSignal,
): Promise<AxeAuditResult> => {
  if (signal.aborted) {
    throw new Error("Axe audit aborted");
  }

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    try {
      let homeHeaders: Record<string, string> = {};
      try {
        const response = await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 45_000,
        });
        homeHeaders = response?.headers() ?? {};
      } catch {
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        homeHeaders = response?.headers() ?? {};
      }

      const pageUrl = page.url();
      if (pageUrl === "about:blank" || !pageUrl.startsWith("http")) {
        throw new Error(`Axe no pudo cargar la página (quedó en ${pageUrl}).`);
      }

      await waitForPageContent(page);

      const pageOrigin = new URL(pageUrl).origin;

      let browserCrawlFiles: CrawlFilesAnalysisResult | null = null;
      try {
        browserCrawlFiles = await analyzeCrawlFiles(
          pageOrigin,
          signal,
          {
            hasStructuredData: false,
            structuredDataTypes: [],
            openGraphComplete: false,
            titleOk: false,
            metaOk: false,
            hasH1: false,
            socialLinkCount: 0,
            hasViewport: false,
            brokenLinkCount: 0,
            imagesWithoutAlt: 0,
          },
          { browser: createBrowserCrawlFileFetcher(page) },
          homeHeaders,
        );

        const hints = await page.evaluate((): HtmlResourceHints => {
          const collect = (selector: string) =>
            [...document.querySelectorAll(selector)]
              .map((el) => (el as HTMLLinkElement).href)
              .filter(Boolean);
          return {
            manifestUrls: collect('link[rel="manifest"]'),
            rssUrls: collect(
              'link[rel="alternate"][type*="rss"], link[rel="alternate"][type*="atom"]',
            ),
            faviconUrls: collect('link[rel="icon"], link[rel="shortcut icon"]'),
            appleTouchIconUrls: collect('link[rel="apple-touch-icon"]'),
          };
        });

        browserCrawlFiles.extended = await analyzeExtendedCrawlFiles(
          pageOrigin,
          signal,
          hints,
          { browser: createBrowserCrawlFileFetcher(page) },
        );
      } catch (crawlCause) {
        console.error("web-audit browser crawl files failed", crawlCause);
      }

      let socialLinks: SocialLinkFound[] = [];
      let pageLinks: PageLinkFound[] = [];
      let pageImages: PageImageFound[] = [];
      try {
        const rendered = await extractRenderedPageContent(page, pageOrigin);
        pageLinks = rendered.links;
        pageImages = rendered.images;
        socialLinks = await extractRenderedSocialLinks(page, pageOrigin);
      } catch (contentCause) {
        console.error("web-audit rendered page content failed", contentCause);
        try {
          socialLinks = await extractRenderedSocialLinks(page, pageOrigin);
        } catch (socialCause) {
          console.error("web-audit rendered social links failed", socialCause);
        }
      }

      const results = await new AxePuppeteer(page as never).analyze();
      const findings = mapAxeViolationsToFindings(results.violations);

      let renderedSeo: RenderedSeoSignals | null = null;
      try {
        renderedSeo = await extractRenderedSeoSignals(page);
      } catch (seoCause) {
        console.error("web-audit rendered SEO extraction failed", seoCause);
      }

      return {
        axeJson: summarizeAxeJson(results),
        findings,
        violationCount: results.violations.length,
        socialLinks,
        pageLinks,
        pageImages,
        renderedSeo,
        browserCrawlFiles,
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser.disconnect();
  }
};
