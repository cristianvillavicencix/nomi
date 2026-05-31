import * as cheerio from "cheerio";
import {
  analyzeExpandedSeo,
  type ExpandedSeoAnalysis,
} from "./expandedSeoAnalysis.js";
import { parseEmbeddedJsonPayloads } from "./embeddedAppPayloads.js";
import {
  detectPageArchitecture,
  type PageArchitecture,
} from "./pageArchitecture.js";
import type { DetectedTechnology } from "./detectTechnologies.js";
import type { RenderedSeoSignals } from "./extractRenderedSeo.js";
import type { StaticAnalysisResult } from "../types.js";
import {
  mergeSeoBasics,
  resolveSeoAuditStrategy,
  type SeoBasics,
} from "./seoSourceResolver.js";

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

const SEO_STRING_KEYS = [
  "title",
  "pageTitle",
  "metaTitle",
  "metaDescription",
  "description",
  "ogTitle",
  "ogDescription",
  "seoTitle",
  "seoDescription",
  "headline",
  "name",
] as const;

const walkForSeoStrings = (
  value: unknown,
  found: SeoBasics,
  depth = 0,
): void => {
  if (depth > 8 || !value) return;

  if (typeof value === "string") {
    if (!found.title && value.length >= 5 && value.length <= 200) {
      found.title = value.trim().slice(0, 300);
    }
    return;
  }

  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  const title =
    (typeof record.title === "string" && record.title.trim()) ||
    (typeof record.pageTitle === "string" && record.pageTitle.trim()) ||
    (typeof record.metaTitle === "string" && record.metaTitle.trim()) ||
    (typeof record.seoTitle === "string" && record.seoTitle.trim()) ||
    (typeof record.ogTitle === "string" && record.ogTitle.trim()) ||
    (typeof record.headline === "string" && record.headline.trim()) ||
    null;

  const meta =
    (typeof record.metaDescription === "string" && record.metaDescription.trim()) ||
    (typeof record.description === "string" && record.description.trim()) ||
    (typeof record.seoDescription === "string" && record.seoDescription.trim()) ||
    (typeof record.ogDescription === "string" && record.ogDescription.trim()) ||
    null;

  if (!found.title && title) found.title = title.slice(0, 300);
  if (!found.metaDescription && meta) found.metaDescription = meta.slice(0, 400);

  if (typeof record.canonical === "string" && !found.canonical) {
    found.canonical = record.canonical.trim();
  }
  if (typeof record.canonicalUrl === "string" && !found.canonical) {
    found.canonical = record.canonicalUrl.trim();
  }

  const nestedKeys = [
    "seo",
    "props",
    "page",
    "pageProps",
    "initialState",
    "initialData",
    "data",
    "meta",
    "metadata",
    "yoast_head_json",
    "yoastHeadJson",
    "shop",
    "product",
    "article",
    "post",
    "attributes",
  ] as const;

  for (const key of nestedKeys) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      walkForSeoStrings(nested, found, depth + 1);
    }
  }

  if (depth < 4) {
    for (const key of SEO_STRING_KEYS) {
      const val = record[key];
      if (typeof val === "string" && val.trim()) {
        if ((key.includes("title") || key === "headline" || key === "name") && !found.title) {
          found.title = val.trim().slice(0, 300);
        }
        if (key.includes("description") && !found.metaDescription) {
          found.metaDescription = val.trim().slice(0, 400);
        }
      }
    }
  }

  if (depth < 6) {
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === "object") {
        walkForSeoStrings(nested, found, depth + 1);
      }
    }
  }
};

const extractEmbeddedSeoFromHtml = (html: string): SeoBasics | null => {
  const $ = cheerio.load(html);
  const found: SeoBasics = {
    title: null,
    metaDescription: null,
    h1Count: 0,
    h1Text: null,
    canonical: null,
  };

  for (const payload of parseEmbeddedJsonPayloads($)) {
    walkForSeoStrings(payload, found);
  }

  $("[data-page]").each((_i, el) => {
    const raw = $(el).attr("data-page");
    if (!raw) return;
    try {
      walkForSeoStrings(JSON.parse(decodeHtmlEntities(raw)), found);
    } catch {
      // ignore
    }
  });

  found.h1Count = $("h1").length;
  found.h1Text = $("h1").first().text().trim() || null;

  if (
    !found.title &&
    !found.metaDescription &&
    !found.canonical &&
    found.h1Count === 0
  ) {
    return null;
  }
  return found;
};

const buildAuditNote = (
  architecture: PageArchitecture,
  strategyReason: string,
  analysisMode: ExpandedSeoAnalysis["analysisMode"],
) => {
  const stack =
    architecture.frameworks.length > 0
      ? architecture.frameworks.join(", ")
      : architecture.platformCategory;
  const modeLabel =
    analysisMode === "rendered"
      ? "DOM renderizado (JavaScript ejecutado)"
      : analysisMode === "embedded"
        ? "JSON embebido + HTML"
        : "HTML server-rendered";
  return `${strategyReason} · ${modeLabel}. Plataforma: ${stack}.`;
};

export const resolvePageArchitecture = (
  html: string,
  technologies: DetectedTechnology[],
): PageArchitecture => detectPageArchitecture(html, technologies);

export const applyMergedSeoAnalysis = (params: {
  staticResult: StaticAnalysisResult;
  staticHtml: string;
  rendered: RenderedSeoSignals | null;
}) => {
  const { staticResult, staticHtml, rendered } = params;
  const architecture =
    staticResult.pageArchitecture ??
    detectPageArchitecture(staticHtml, staticResult.technologies ?? []);

  staticResult.pageArchitecture = architecture;

  const staticBasics: SeoBasics = {
    title: staticResult.title,
    metaDescription: staticResult.metaDescription,
    h1Count: staticResult.h1Count,
    h1Text: staticResult.h1Text,
    canonical: staticResult.canonical,
  };

  const embedded = extractEmbeddedSeoFromHtml(staticHtml);
  const strategy = resolveSeoAuditStrategy({
    architecture,
    staticBasics,
    embedded,
    rendered,
    staticHtml,
  });

  const merged = mergeSeoBasics({
    strategy,
    staticBasics,
    embedded,
    rendered,
  });

  staticResult.title = merged.title;
  staticResult.metaDescription = merged.metaDescription;
  staticResult.h1Count = merged.h1Count;
  staticResult.h1Text = merged.h1Text;
  staticResult.canonical = merged.canonical;

  const seoHtml = strategy.preferRendered && rendered?.html ? rendered.html : staticHtml;
  const $ = cheerio.load(seoHtml);

  if (strategy.preferRendered && rendered?.html) {
    const viewport =
      $('meta[name="viewport"]').attr("content")?.trim() ||
      staticResult.viewport;
    if (viewport) staticResult.viewport = viewport;
  }

  const expandedSeo: ExpandedSeoAnalysis = {
    ...analyzeExpandedSeo($, {
      title: merged.title,
      metaDescription: merged.metaDescription,
      h1Count: merged.h1Count,
      h1Text: merged.h1Text,
      canonical: merged.canonical,
    }),
    analysisMode: strategy.analysisMode,
    pageArchitecture: architecture,
    auditNote: buildAuditNote(
      architecture,
      strategy.auditReason,
      strategy.analysisMode,
    ),
  };

  if (strategy.preferRendered && rendered) {
    expandedSeo.h1Texts =
      rendered.h1Texts.length > 0 ? rendered.h1Texts : expandedSeo.h1Texts;
    expandedSeo.multipleH1 = rendered.h1Count > 1;
  }

  staticResult.expandedSeo = expandedSeo;
};
