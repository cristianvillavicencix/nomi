import type { AuditStrategySnapshot, WebsiteAudit } from "@/lbs/website-monitor/audit/types";

export const isUnifiedReport = (audit: WebsiteAudit) =>
  audit.strategy === "unified" ||
  (audit.mobile_snapshot != null && audit.desktop_snapshot != null);

/** Resolve mobile/desktop lab data for unified or legacy single-strategy audits. */
export const getAuditSnapshots = (
  audit: WebsiteAudit,
): { mobile: AuditStrategySnapshot | null; desktop: AuditStrategySnapshot | null } => {
  if (audit.mobile_snapshot || audit.desktop_snapshot) {
    return {
      mobile: audit.mobile_snapshot ?? null,
      desktop: audit.desktop_snapshot ?? null,
    };
  }

  const legacy: AuditStrategySnapshot = {
    overall_score: audit.overall_score,
    score_performance: audit.score_performance,
    score_seo: audit.score_seo,
    score_best_practices: audit.score_best_practices,
    score_accessibility: audit.score_accessibility,
    lab_lcp_ms: audit.lab_lcp_ms,
    lab_cls: audit.lab_cls,
    lab_tbt_ms: audit.lab_tbt_ms,
    lighthouse_json: audit.lighthouse_json ?? null,
    axe_json: audit.axe_json ?? null,
  };

  if (audit.strategy === "desktop") {
    return { mobile: null, desktop: legacy };
  }
  return { mobile: legacy, desktop: null };
};

export const snapshotScores = (snapshot: AuditStrategySnapshot | null) => ({
  overall: snapshot?.overall_score ?? null,
  performance: snapshot?.score_performance ?? null,
  seo: snapshot?.score_seo ?? null,
  bestPractices: snapshot?.score_best_practices ?? null,
  accessibility: snapshot?.score_accessibility ?? null,
  labLcpMs: snapshot?.lab_lcp_ms ?? null,
  labFcpMs: snapshot?.lab_fcp_ms ?? null,
  labCls: snapshot?.lab_cls ?? null,
  labTbtMs: snapshot?.lab_tbt_ms ?? null,
});

export const auditHasLighthouseScores = (audit: WebsiteAudit) => {
  if (audit.overall_score != null) return true;
  const { mobile, desktop } = getAuditSnapshots(audit);
  return (
    snapshotScores(mobile).overall != null ||
    snapshotScores(desktop).overall != null
  );
};
