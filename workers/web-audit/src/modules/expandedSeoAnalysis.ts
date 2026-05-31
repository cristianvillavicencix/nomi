import type { CheerioAPI } from "cheerio";
import type { PageArchitecture } from "./pageArchitecture.js";

export type ExpandedSeoAnalysis = {
  titleLength: number | null;
  titleLengthStatus: "ok" | "short" | "long" | "missing";
  metaDescriptionLength: number | null;
  metaDescriptionLengthStatus: "ok" | "short" | "long" | "missing";
  h1Texts: string[];
  multipleH1: boolean;
  htmlLang: string | null;
  robotsMeta: string | null;
  noindex: boolean;
  nofollow: boolean;
  hreflang: Array<{ lang: string; href: string }>;
  openGraph: {
    tags: Record<string, string>;
    missingRequired: string[];
    complete: boolean;
  };
  twitterCard: {
    tags: Record<string, string>;
    missingRecommended: string[];
    complete: boolean;
  };
  structuredData: Array<{
    type: string;
    context?: string | null;
  }>;
  hasStructuredData: boolean;
  checksPassed: number;
  checksTotal: number;
  expandedSeoScore: number | null;
  /** static = HTML inicial, rendered = DOM post-JS, embedded = JSON Inertia/Next. */
  analysisMode?: "static" | "rendered" | "embedded";
  pageArchitecture?: PageArchitecture;
  auditNote?: string | null;
};

const OG_REQUIRED = ["og:title", "og:description", "og:image", "og:url", "og:type"];
const TWITTER_RECOMMENDED = [
  "twitter:card",
  "twitter:title",
  "twitter:description",
];

const titleLengthStatus = (
  length: number | null,
): ExpandedSeoAnalysis["titleLengthStatus"] => {
  if (length == null || length === 0) return "missing";
  if (length < 30) return "short";
  if (length > 60) return "long";
  return "ok";
};

const metaLengthStatus = (
  length: number | null,
): ExpandedSeoAnalysis["metaDescriptionLengthStatus"] => {
  if (length == null || length === 0) return "missing";
  if (length < 120) return "short";
  if (length > 160) return "long";
  return "ok";
};

const parseJsonLdType = (value: unknown): string[] => {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseJsonLdType(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    const graph = record["@graph"];
    const types = parseJsonLdType(type);
    if (Array.isArray(graph)) {
      return [...types, ...graph.flatMap((node) => parseJsonLdType(node))];
    }
    return types;
  }
  return [];
};

export const analyzeExpandedSeo = (
  $: CheerioAPI,
  params: {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    h1Count: number;
    h1Text: string | null;
  },
): ExpandedSeoAnalysis => {
  const titleLength = params.title?.length ?? null;
  const metaDescriptionLength = params.metaDescription?.length ?? null;

  const h1Texts: string[] = [];
  $("h1").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) h1Texts.push(text.slice(0, 200));
  });

  const htmlLang = $("html").attr("lang")?.trim() || null;

  const robotsMeta =
    $('meta[name="robots"]').attr("content")?.trim().toLowerCase() ?? null;
  const noindex = robotsMeta?.includes("noindex") ?? false;
  const nofollow = robotsMeta?.includes("nofollow") ?? false;

  const hreflang: Array<{ lang: string; href: string }> = [];
  $('link[rel="alternate"][hreflang]').each((_i, el) => {
    const lang = $(el).attr("hreflang")?.trim();
    const href = $(el).attr("href")?.trim();
    if (lang && href && hreflang.length < 20) {
      hreflang.push({ lang, href });
    }
  });

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_i, el) => {
    const property = $(el).attr("property")?.trim();
    const content = $(el).attr("content")?.trim();
    if (property && content) ogTags[property] = content;
  });

  const missingOg = OG_REQUIRED.filter((key) => !ogTags[key]?.trim());
  const openGraph = {
    tags: ogTags,
    missingRequired: missingOg,
    complete: missingOg.length === 0,
  };

  const twitterTags: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_i, el) => {
    const name = $(el).attr("name")?.trim();
    const content = $(el).attr("content")?.trim();
    if (name && content) twitterTags[name] = content;
  });

  const missingTwitter = TWITTER_RECOMMENDED.filter(
    (key) => !twitterTags[key]?.trim(),
  );
  const twitterCard = {
    tags: twitterTags,
    missingRecommended: missingTwitter,
    complete: missingTwitter.length === 0,
  };

  const structuredData: ExpandedSeoAnalysis["structuredData"] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    if (structuredData.length >= 12) return;
    const raw = $(el).html()?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const types = [...new Set(parseJsonLdType(parsed))].filter(Boolean);
      if (types.length === 0) {
        structuredData.push({ type: "JSON-LD", context: null });
        return;
      }
      for (const type of types.slice(0, 4)) {
        structuredData.push({
          type: String(type),
          context:
            typeof parsed === "object" &&
            parsed &&
            "@context" in (parsed as object)
              ? String((parsed as Record<string, unknown>)["@context"] ?? "")
              : null,
        });
      }
    } catch {
      structuredData.push({ type: "JSON-LD (inválido)", context: null });
    }
  });

  const checks: boolean[] = [
    titleLengthStatus(titleLength) === "ok",
    metaLengthStatus(metaDescriptionLength) === "ok",
    params.h1Count === 1,
    !noindex,
    Boolean(params.canonical?.trim()),
    Boolean(htmlLang),
    openGraph.complete,
    twitterCard.complete || openGraph.complete,
    structuredData.length > 0,
    hreflang.length === 0 || hreflang.length >= 1,
    Boolean(params.metaDescription?.trim()),
  ];

  const checksPassed = checks.filter(Boolean).length;
  const checksTotal = checks.length;
  const expandedSeoScore = Math.round((checksPassed / checksTotal) * 100);

  return {
    titleLength,
    titleLengthStatus: titleLengthStatus(titleLength),
    metaDescriptionLength,
    metaDescriptionLengthStatus: metaLengthStatus(metaDescriptionLength),
    h1Texts,
    multipleH1: params.h1Count > 1,
    htmlLang,
    robotsMeta,
    noindex,
    nofollow,
    hreflang,
    openGraph,
    twitterCard,
    structuredData,
    hasStructuredData: structuredData.length > 0,
    checksPassed,
    checksTotal,
    expandedSeoScore,
  };
};
