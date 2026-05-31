export type WebsiteAuditStrategy = "mobile" | "desktop" | "unified";

export type { CrawlFilesAnalysisResult } from "./modules/crawlFilesAnalysis.js";
import type { CrawlFilesAnalysisResult } from "./modules/crawlFilesAnalysis.js";

export type FormFactorStrategy = "mobile" | "desktop";

export type AuditStrategySnapshot = {
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
  lab_fcp_ms?: number | null;
  lab_cls?: number | null;
  lab_tbt_ms?: number | null;
  lighthouse_json?: Record<string, unknown> | null;
  axe_json?: Record<string, unknown> | null;
};

export type AuditFindingInput = {
  category:
    | "performance"
    | "seo"
    | "a11y"
    | "security"
    | "static"
    | "best_practices";
  severity: "critico" | "importante" | "nice-to-have";
  source: "lighthouse" | "axe" | "static" | "crux" | "nomi";
  source_id?: string | null;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  commercial_message?: string | null;
  metric_key?: string | null;
  metric_value?: string | null;
  display_order?: number;
};

export type WebsiteAuditCallbackPayload = {
  audit_id: number;
  status: "running" | "done" | "failed";
  worker_id?: string | null;
  strategy?: WebsiteAuditStrategy | null;
  progress_phase?: "static" | "mobile" | "desktop" | "crux" | null;
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
  lab_fcp_ms?: number | null;
  lab_cls?: number | null;
  lab_tbt_ms?: number | null;
  static_json?: Record<string, unknown> | null;
  lighthouse_json?: Record<string, unknown> | null;
  axe_json?: Record<string, unknown> | null;
  mobile_snapshot?: AuditStrategySnapshot | null;
  desktop_snapshot?: AuditStrategySnapshot | null;
  field_lcp_ms?: number | null;
  field_cls?: number | null;
  field_inp_ms?: number | null;
  crux_has_data?: boolean | null;
  crux_json?: Record<string, unknown> | null;
  pdf_storage_path?: string | null;
  error_message?: string | null;
  findings?: AuditFindingInput[];
};

export type ExpandedSeoAnalysisResult = {
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
  structuredData: Array<{ type: string; context?: string | null }>;
  hasStructuredData: boolean;
  checksPassed: number;
  checksTotal: number;
  expandedSeoScore: number | null;
  analysisMode?: "static" | "rendered" | "embedded";
  pageArchitecture?: PageArchitectureResult;
  auditNote?: string | null;
};

export type PageArchitectureResult = {
  renderingModel: "static" | "spa" | "ssr" | "hybrid";
  platformCategory:
    | "cms"
    | "ecommerce"
    | "site_builder"
    | "saas"
    | "spa"
    | "ssr"
    | "static"
    | "unknown";
  frameworks: string[];
  seoAuditBasis: "static_html" | "rendered_dom" | "embedded_json";
  signals: string[];
};

export type DetectedTechnology = {
  name: string;
  confidence: string;
  version: string | null;
  categories: string[];
  website: string | null;
  icon: string | null;
};

export type WebsiteAuditWorkerJob = {
  audit_id: number;
  org_id: number;
  monitored_website_id: number;
  url: string;
  strategy: WebsiteAuditStrategy;
  callback_url: string;
};

export type StaticAnalysisResult = {
  url: string;
  finalUrl: string | null;
  httpStatus: number | null;
  htmlBytes: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  canonical: string | null;
  viewport: string | null;
  og: Record<string, string>;
  twitter: Record<string, string>;
  imagesWithoutAlt: number;
  totalImages: number;
  /** Up to 12 images missing alt (src + optional filename). */
  imagesMissingAlt: Array<{ src: string; filename: string | null }>;
  /** Social profile links found in page anchors / JSON-LD. */
  socialLinks: Array<{ network: string; url: string; label?: string | null }>;
  /** On-page hyperlinks with HTTP status (rendered DOM + static HTML). */
  pageLinks?: Array<{
    url: string;
    text?: string | null;
    isInternal: boolean;
    status: number | null;
    ok: boolean;
    error?: string | null;
  }>;
  /** Raw links from static HTML (merged at audit time). */
  staticPageLinks?: Array<{
    url: string;
    text?: string | null;
    isInternal: boolean;
  }>;
  totalPageLinks?: number;
  brokenLinkCount?: number;
  checkedLinkCount?: number;
  /** Full image inventory from rendered DOM. */
  pageImages?: Array<{
    src: string;
    filename: string | null;
    alt: string | null;
    status: "ok" | "missing_alt" | "broken";
    width?: number | null;
    height?: number | null;
  }>;
  brokenImages?: number;
  imagesOk?: number;
  hasRobotsTxt: boolean;
  robotsTxtStatus: number | null;
  hasSitemap: boolean;
  sitemapStatus: number | null;
  crawlFiles?: CrawlFilesAnalysisResult | null;
  expandedSeo?: ExpandedSeoAnalysisResult | null;
  technologies?: DetectedTechnology[];
  pageArchitecture?: PageArchitectureResult | null;
  /** HTML crudo para merge SEO (no se envía al callback). */
  sourceHtml?: string;
  responseHeaders?: Record<string, string>;
  domainInfra?: import("./modules/domainInfraAnalysis.js").DomainInfraAnalysis;
  complianceSignals?: import("./modules/complianceAnalysis.js").ComplianceSignals;
  blockedLikely: boolean;
  /** Fetch HTTP bloqueado por WAF; audit continúa con Chrome. */
  staticFetchBlocked?: boolean;
  /** HTML estático recuperado vía navegador tras WAF. */
  staticFetchRecovered?: boolean;
  fetchError: string | null;
};

export type LighthouseScores = {
  performance: number | null;
  seo: number | null;
  bestPractices: number | null;
  accessibility: number | null;
  overall: number | null;
  labLcpMs: number | null;
  labFcpMs: number | null;
  labCls: number | null;
  labTbtMs: number | null;
  lighthouseJson: Record<string, unknown>;
};
