import type { AuditFindingInput } from "../types.js";
import { lighthouseFixHint } from "./lighthouseAuditHints.js";

type LighthouseAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    items?: Array<Record<string, unknown>>;
    overallSavingsMs?: number;
  } | null;
};

type LighthouseCategory = {
  id?: string;
  title?: string;
  score?: number | null;
  auditRefs?: Array<{ id: string; weight?: number }>;
};

type LighthouseReport = {
  categories?: Record<string, LighthouseCategory>;
  audits?: Record<string, LighthouseAudit>;
};

const CATEGORY_MAP: Record<string, AuditFindingInput["category"]> = {
  performance: "performance",
  seo: "seo",
  accessibility: "a11y",
  "best-practices": "best_practices",
};

const severityFromScore = (score: number): AuditFindingInput["severity"] => {
  if (score < 0.5) return "critico";
  if (score < 0.9) return "importante";
  return "nice-to-have";
};

const formatItemLine = (item: Record<string, unknown>): string | null => {
  const url =
    (item.url as string) ||
    (item.source as string) ||
    (item.node as string) ||
    (item.href as string);
  const label =
    (item.nodeLabel as string) ||
    (item.text as string) ||
    (item.name as string);
  if (url && label) return `${label}: ${String(url).slice(0, 120)}`;
  if (url) return String(url).slice(0, 140);
  if (label) return String(label).slice(0, 140);
  const first = Object.values(item).find(
    (v) => typeof v === "string" && v.length > 3,
  );
  return first ? String(first).slice(0, 140) : null;
};

const extractLocations = (audit: LighthouseAudit): string[] => {
  const raw = audit.details?.items;
  const items = Array.isArray(raw) ? raw : [];
  const lines: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const line = formatItemLine(item as Record<string, unknown>);
    if (line) lines.push(line);
    if (lines.length >= 4) break;
  }
  return lines;
};

const buildDescription = (
  audit: LighthouseAudit,
  categoryScore: number | null,
  weight: number | undefined,
  locations: string[],
): string => {
  const parts: string[] = [];
  if (categoryScore != null) {
    parts.push(`Esta regla afecta la categoría con score ${categoryScore}/100.`);
  }
  if (weight != null && weight > 0) {
    parts.push(`Peso en el cálculo Lighthouse: ${weight}.`);
  }
  if (audit.displayValue) {
    parts.push(`Medición: ${audit.displayValue}.`);
  }
  if (audit.description?.trim()) {
    parts.push(audit.description.trim());
  }
  if (locations.length > 0) {
    parts.push(`Dónde: ${locations.join(" · ")}`);
  }
  if (audit.details?.overallSavingsMs && audit.details.overallSavingsMs > 0) {
    parts.push(
      `Ahorro estimado si se corrige: ~${(audit.details.overallSavingsMs / 1000).toFixed(1)} s.`,
    );
  }
  return parts.join(" ");
};

export const mapDetailedLighthouseFindings = (
  lighthouseJson: Record<string, unknown> | null | undefined,
  deviceLabel: string,
  orderStart: number,
  maxFindings = 35,
): AuditFindingInput[] => {
  if (!lighthouseJson) return [];

  const lhr = lighthouseJson as LighthouseReport;
  const findings: AuditFindingInput[] = [];
  let order = orderStart;

  for (const [catId, category] of Object.entries(lhr.categories ?? {})) {
    const categoryScore =
      category.score != null ? Math.round(category.score * 100) : null;

    const refs = Array.isArray(category.auditRefs) ? category.auditRefs : [];
    for (const ref of refs) {
      const audit = lhr.audits?.[ref.id];
      if (!audit) continue;
      if (
        audit.scoreDisplayMode === "informative" ||
        audit.scoreDisplayMode === "manual"
      ) {
        continue;
      }
      if (audit.score == null || audit.score >= 0.9) continue;

      const auditId = audit.id ?? ref.id;
      const locations = extractLocations(audit);

      findings.push({
        category: CATEGORY_MAP[catId] ?? "static",
        severity: severityFromScore(audit.score),
        source: "lighthouse",
        source_id: auditId,
        title: `[${deviceLabel}] ${audit.title ?? auditId}`,
        description: buildDescription(
          audit,
          categoryScore,
          ref.weight,
          locations,
        ),
        recommendation: lighthouseFixHint(auditId, null),
        metric_key: `lh:${auditId}`,
        metric_value:
          audit.displayValue ??
          (audit.score != null ? String(Math.round(audit.score * 100)) : null),
        display_order: order++,
      });
    }
  }

  return findings
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .slice(0, maxFindings);
};
