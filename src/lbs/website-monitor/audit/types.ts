export type WebsiteAuditStatus = "queued" | "running" | "done" | "failed";

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
  pdf_storage_path?: string | null;
  error_message?: string | null;
};

export type AuditFinding = {
  id: number;
  audit_id: number;
  category: string;
  severity: "critico" | "importante" | "nice-to-have";
  source: string;
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
