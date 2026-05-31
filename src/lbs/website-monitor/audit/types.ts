export type WebsiteAuditAiSummaryStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export type WebsiteAuditAiFindingInsight = {
  rank: number;
  plain_language: string;
  business_impact?: string | null;
};

export type WebsiteAuditAiMetricsNarrative = {
  overview?: string | null;
  scores?: {
    overall?: string | null;
    performance?: string | null;
    seo?: string | null;
    accessibility?: string | null;
    best_practices?: string | null;
  };
  core_web_vitals?: {
    summary?: string | null;
    lcp?: string | null;
    cls?: string | null;
    inp?: string | null;
    fcp?: string | null;
    tbt?: string | null;
  };
};

export type WebsiteAuditAiSummaryJson = {
  executive_summary: string;
  overall_health: "good" | "needs_work" | "critical";
  priority_actions: Array<{
    rank: number;
    title: string;
    why: string;
    how: string;
    impact: "high" | "medium" | "low";
    category?: string | null;
    expected_result?: string | null;
  }>;
  highlights: {
    strengths: string[];
    risks: string[];
  };
  technical_notes?: string | null;
  finding_insights?: WebsiteAuditAiFindingInsight[];
  metrics_narrative?: WebsiteAuditAiMetricsNarrative | null;
  links_narrative?: string | null;
  expected_outcomes?: Array<{
    area: string;
    recommendation: string;
    expected_result: string;
  }> | null;
  transformation_closing?: string | null;
};

export type WebsiteAuditStatus = "queued" | "running" | "done" | "failed";

export type PageImageJson = {
  src: string;
  filename: string | null;
  alt: string | null;
  status: "ok" | "missing_alt" | "broken";
  width?: number | null;
  height?: number | null;
};

export type PageLinkJson = {
  url: string;
  text?: string | null;
  isInternal: boolean;
  status: number | null;
  ok: boolean;
  error?: string | null;
};

export type ExpandedSeoJson = {
  titleLength?: number | null;
  titleLengthStatus?: "ok" | "short" | "long" | "missing";
  metaDescriptionLength?: number | null;
  metaDescriptionLengthStatus?: "ok" | "short" | "long" | "missing";
  h1Texts?: string[];
  multipleH1?: boolean;
  htmlLang?: string | null;
  robotsMeta?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
  hreflang?: Array<{ lang: string; href: string }>;
  openGraph?: {
    tags?: Record<string, string>;
    missingRequired?: string[];
    complete?: boolean;
  };
  twitterCard?: {
    tags?: Record<string, string>;
    missingRecommended?: string[];
    complete?: boolean;
  };
  structuredData?: Array<{ type: string; context?: string | null }>;
  hasStructuredData?: boolean;
  checksPassed?: number;
  checksTotal?: number;
  expandedSeoScore?: number | null;
  analysisMode?: "static" | "rendered" | "embedded";
  pageArchitecture?: PageArchitectureJson;
  auditNote?: string | null;
};

export type PageArchitectureJson = {
  renderingModel: "static" | "spa" | "ssr" | "hybrid";
  platformCategory?:
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
  signals?: string[];
};

export type DetectedTechnologyJson = {
  name: string;
  confidence: string;
  version: string | null;
  categories: string[];
  website: string | null;
  icon: string | null;
};

export type CrawlResourceAccess = "found" | "missing" | "blocked" | "error";
export type CrawlResourceSource = "fetch" | "browser" | "merged";

export type CrawlFileJson = {
  url: string;
  status?: number | null;
  fetchStatus?: number | null;
  browserStatus?: number | null;
  access?: CrawlResourceAccess;
  source?: CrawlResourceSource;
  content?: string | null;
  contentTruncated?: boolean;
  found: boolean;
};

export type RobotsTxtJson = CrawlFileJson & {
  sitemapUrls?: string[];
  blocksAllCrawlers?: boolean;
  blockedAiAgents?: string[];
  allowsAiCrawlers?: boolean;
  hasSitemapDirective?: boolean;
};

export type SitemapJson = CrawlFileJson & {
  urlCount?: number | null;
  sitemapRoute?:
    | "default"
    | "robots_txt"
    | "wp_sitemap"
    | "sitemap_index"
    | "none";
  candidatesTried?: string[];
  /** @deprecated use sitemapRoute */
  source?: "default" | "robots_txt" | "wp_sitemap" | "sitemap_index" | "none";
};

export type LlmsTxtJson = CrawlFileJson & {
  lineCount?: number;
  hasTitle?: boolean;
  hasDescription?: boolean;
  hasMarkdownLinks?: boolean;
  mentionsSitemap?: boolean;
  sectionCount?: number;
};

export type SecurityTxtJson = CrawlFileJson & {
  hasContact?: boolean;
  hasPolicy?: boolean;
};

export type SiteInfraJson = {
  waf: {
    detected: boolean;
    providers: string[];
    signals: string[];
  };
  headers: {
    strictTransportSecurity: boolean;
    contentSecurityPolicy: boolean;
    xRobotsTag: string | null;
    xFrameOptions: string | null;
    permissionsPolicy: boolean;
    noindexHeader: boolean;
  };
  headerSample?: Record<string, string>;
};

export type AiSeoChecklistItemJson = {
  id: string;
  pillar: "on_page" | "social" | "links" | "usability" | "performance";
  label: string;
  ok: boolean;
  detail?: string | null;
  recommendation?: string | null;
  manual?: boolean;
};

export type AiSeoChecklistJson = {
  passed: number;
  total: number;
  score: number | null;
  items: AiSeoChecklistItemJson[];
};

export type ExtendedCrawlFilesJson = {
  humansTxt?: CrawlFileJson;
  adsTxt?: CrawlFileJson;
  webManifest?: CrawlFileJson & { hasName?: boolean; hasIcons?: boolean };
  rssFeed?: CrawlFileJson & { feedType?: "rss" | "atom" | null };
  favicon?: CrawlFileJson;
  appleTouchIcon?: CrawlFileJson;
};

export type DomainInfraJson = {
  hostname: string;
  dns: {
    ip: string | null;
    nameservers: string[];
    mx: string[];
    registrar: string | null;
  };
  emailAuth: {
    spf: boolean;
    dmarc: boolean;
    spfRecord: string | null;
    dmarcRecord: string | null;
  };
  ssl: {
    expiresAt: string | null;
    daysRemaining: number | null;
    ok: boolean;
  };
  hostVariant: {
    primaryUrl: string;
    alternateUrl: string | null;
    alternateStatus: number | null;
    canonicalHost: "www" | "apex" | "mixed" | "unknown";
    hostsMatch: boolean;
    note: string | null;
  };
};

export type ComplianceSignalsJson = {
  hasPrivacyLink: boolean;
  privacyUrls: string[];
  hasCookieBanner: boolean;
  cookieBannerSignals: string[];
  hasTelLink: boolean;
  telLinks: string[];
  napInSchema: boolean;
  schemaPhone: string | null;
  schemaAddress: string | null;
};

export type CrawlFilesJson = {
  siteOrigin: string;
  robots: RobotsTxtJson;
  sitemap: SitemapJson;
  llmsTxt: LlmsTxtJson;
  securityTxt?: SecurityTxtJson;
  siteInfra?: SiteInfraJson;
  extended?: ExtendedCrawlFilesJson;
  aiSeoChecklist: AiSeoChecklistJson;
};

export type StaticAnalysisJson = {
  url?: string;
  finalUrl?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  h1Count?: number;
  h1Text?: string | null;
  imagesWithoutAlt?: number;
  totalImages?: number;
  imagesMissingAlt?: Array<{ src: string; filename: string | null }>;
  imagesOk?: number;
  brokenImages?: number;
  pageImages?: PageImageJson[];
  socialLinks?: Array<{ network: string; url: string; label?: string | null }>;
  pageLinks?: PageLinkJson[];
  totalPageLinks?: number;
  brokenLinkCount?: number;
  checkedLinkCount?: number;
  hasRobotsTxt?: boolean;
  hasSitemap?: boolean;
  crawlFiles?: CrawlFilesJson | null;
  domainInfra?: DomainInfraJson | null;
  complianceSignals?: ComplianceSignalsJson | null;
  staticFetchBlocked?: boolean;
  staticFetchRecovered?: boolean;
  httpStatus?: number | null;
  expandedSeo?: ExpandedSeoJson | null;
  technologies?: DetectedTechnologyJson[];
  pageArchitecture?: PageArchitectureJson | null;
};

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

export type WebsiteAudit = {
  id: number;
  org_id: number;
  monitored_website_id: number;
  status: WebsiteAuditStatus;
  audit_url: string;
  strategy: "mobile" | "desktop" | "unified";
  requested_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
  lab_cls?: number | null;
  lab_tbt_ms?: number | null;
  field_lcp_ms?: number | null;
  field_cls?: number | null;
  field_inp_ms?: number | null;
  crux_has_data?: boolean | null;
  crux_json?: { crux_data_level?: "url" | "origin" | "none" } | null;
  mobile_snapshot?: AuditStrategySnapshot | null;
  desktop_snapshot?: AuditStrategySnapshot | null;
  lighthouse_json?: Record<string, unknown> | null;
  axe_json?: Record<string, unknown> | null;
  progress_phase?: "static" | "mobile" | "desktop" | "crux" | null;
  static_json?: StaticAnalysisJson | null;
  pdf_storage_path?: string | null;
  error_message?: string | null;
  ai_summary_status?: WebsiteAuditAiSummaryStatus | null;
  ai_summary_json?: WebsiteAuditAiSummaryJson | null;
  ai_summary_error?: string | null;
  ai_summary_generated_at?: string | null;
};

export type AuditFinding = {
  id: number;
  audit_id: number;
  category: string;
  severity: "critico" | "importante" | "nice-to-have";
  source: string;
  source_id?: string | null;
  title: string;
  description?: string | null;
  recommendation?: string | null;
  commercial_message?: string | null;
  metric_key?: string | null;
  metric_value?: string | null;
  display_order: number;
};

export type WebsiteAuditEnqueueResult = {
  ok: boolean;
  reused: boolean;
  audit: WebsiteAudit;
  worker?: { pushed?: boolean; error?: string };
};
