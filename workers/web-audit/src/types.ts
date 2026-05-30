export type WebsiteAuditStrategy = "mobile" | "desktop" | "unified";

export type FormFactorStrategy = "mobile" | "desktop";

export type AuditStrategySnapshot = {
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
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
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
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
  hasRobotsTxt: boolean;
  robotsTxtStatus: number | null;
  hasSitemap: boolean;
  sitemapStatus: number | null;
  blockedLikely: boolean;
  fetchError: string | null;
};

export type LighthouseScores = {
  performance: number | null;
  seo: number | null;
  bestPractices: number | null;
  accessibility: number | null;
  overall: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  labTbtMs: number | null;
  lighthouseJson: Record<string, unknown>;
};
