import type {
  AuditFinding,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";

export type FindingAiInsight = {
  plain_language: string;
  business_impact?: string | null;
};

export const sortFindingsByOrder = (findings: AuditFinding[]) =>
  [...findings].sort((a, b) => a.display_order - b.display_order);

export const buildFindingInsightMap = (
  findings: AuditFinding[],
  aiSummary?: WebsiteAuditAiSummaryJson | null,
): Map<number, FindingAiInsight> => {
  const map = new Map<number, FindingAiInsight>();
  const insights = aiSummary?.finding_insights ?? [];
  if (insights.length === 0) return map;

  const sorted = sortFindingsByOrder(findings);
  for (const insight of insights) {
    const finding = sorted[insight.rank - 1];
    if (!finding || !insight.plain_language?.trim()) continue;
    map.set(finding.id, {
      plain_language: insight.plain_language.trim(),
      business_impact: insight.business_impact?.trim() || null,
    });
  }
  return map;
};

export const getMetricsNarrative = (
  aiSummary?: WebsiteAuditAiSummaryJson | null,
) => aiSummary?.metrics_narrative ?? null;

export const getLinksNarrative = (
  aiSummary?: WebsiteAuditAiSummaryJson | null,
) => aiSummary?.links_narrative?.trim() || null;
