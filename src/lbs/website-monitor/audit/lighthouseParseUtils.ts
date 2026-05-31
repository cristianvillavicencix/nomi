import {
  formatLabMetric,
  labMetricScore,
} from "@/lbs/website-monitor/audit/labMetricUtils";

type LighthouseAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: Record<string, unknown> | null;
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

export type LighthouseOpportunity = {
  id: string;
  title: string;
  description: string;
  savingsMs: number | null;
  score: number | null;
};

export type LighthouseCategoryStat = {
  id: string;
  label: string;
  score: number | null;
  passed: number;
  total: number;
};

export type LighthouseAuditIssue = {
  id: string;
  title: string;
  description: string;
  displayValue?: string | null;
  score: number | null;
  weight: number | null;
  status: "failed" | "warning" | "passed";
  locations: string[];
  savingsMs: number | null;
  fixHint?: string | null;
};

export type LabMetricDetail = {
  key: string;
  label: string;
  value: number | null;
  formatted: string;
  score: number | null;
  rating: "good" | "needs-improvement" | "poor" | "unknown";
  explanation: string;
  thresholds: string;
  contributesTo: string;
};

export type ExtendedLabMetrics = {
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  siMs: number | null;
  ttiMs: number | null;
};

const auditNumeric = (audits: Record<string, LighthouseAudit>, id: string) => {
  const value = audits[id]?.numericValue;
  return value != null && Number.isFinite(value) ? Number(value) : null;
};

export const parseExtendedLabMetrics = (
  lighthouseJson?: Record<string, unknown> | null,
): ExtendedLabMetrics => {
  const audits = (lighthouseJson as LighthouseReport | null)?.audits ?? {};
  return {
    fcpMs: auditNumeric(audits, "first-contentful-paint"),
    lcpMs: auditNumeric(audits, "largest-contentful-paint"),
    cls: auditNumeric(audits, "cumulative-layout-shift"),
    tbtMs: auditNumeric(audits, "total-blocking-time"),
    siMs: auditNumeric(audits, "speed-index"),
    ttiMs: auditNumeric(audits, "interactive"),
  };
};

const readSavingsMs = (audit: LighthouseAudit) => {
  const details = audit.details;
  if (details && typeof details.overallSavingsMs === "number") {
    return Math.round(details.overallSavingsMs);
  }
  if (details && typeof details.overallSavings === "number") {
    return Math.round(details.overallSavings);
  }
  if (audit.numericValue != null && Number.isFinite(audit.numericValue)) {
    return Math.round(audit.numericValue);
  }
  return null;
};

export const parseLighthouseOpportunities = (
  lighthouseJson?: Record<string, unknown> | null,
): LighthouseOpportunity[] => {
  const lhr = lighthouseJson as LighthouseReport | null;
  const audits = lhr?.audits ?? {};
  const items: LighthouseOpportunity[] = [];

  for (const [id, audit] of Object.entries(audits)) {
    if (!audit?.title) continue;
    const detailsType =
      audit.details && typeof audit.details.type === "string"
        ? audit.details.type
        : null;
    const isOpportunity =
      detailsType === "opportunity" ||
      audit.scoreDisplayMode === "metricSavings" ||
      (audit.score != null &&
        audit.score < 0.99 &&
        readSavingsMs(audit) != null &&
        readSavingsMs(audit)! > 0);
    if (!isOpportunity) continue;
    if (audit.score != null && audit.score >= 0.99) continue;

    items.push({
      id,
      title: audit.title,
      description: audit.description ?? "",
      savingsMs: readSavingsMs(audit),
      score: audit.score ?? null,
    });
  }

  return items.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0));
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance (Velocidad)",
  accessibility: "Accessibility (Accesibilidad)",
  "best-practices": "Best Practices (Buenas prácticas)",
  seo: "SEO",
};

export const parseLighthouseCategoryStats = (
  lighthouseJson?: Record<string, unknown> | null,
): LighthouseCategoryStat[] => {
  const lhr = lighthouseJson as LighthouseReport | null;
  const categories = lhr?.categories ?? {};
  const audits = lhr?.audits ?? {};

  return ["performance", "accessibility", "best-practices", "seo"].map((id) => {
    const category = categories[id];
    const refs = category?.auditRefs ?? [];
    let passed = 0;
    let total = 0;

    for (const ref of refs) {
      const audit = audits[ref.id];
      if (!audit || audit.scoreDisplayMode === "informative") continue;
      if (audit.score == null) continue;
      total += 1;
      if (audit.score >= 0.9) passed += 1;
    }

    return {
      id,
      label: CATEGORY_LABELS[id] ?? id,
      score: category?.score != null ? Math.round(category.score * 100) : null,
      passed,
      total,
    };
  });
};

export const mergeCategoryStatsWithSnapshot = (
  lighthouseJson: Record<string, unknown> | null | undefined,
  snapshot: {
    score_performance?: number | null;
    score_seo?: number | null;
    score_best_practices?: number | null;
    score_accessibility?: number | null;
  } | null,
): LighthouseCategoryStat[] => {
  const parsed = parseLighthouseCategoryStats(lighthouseJson);
  const fallback: Record<string, number | null | undefined> = {
    performance: snapshot?.score_performance,
    accessibility: snapshot?.score_accessibility,
    "best-practices": snapshot?.score_best_practices,
    seo: snapshot?.score_seo,
  };

  return parsed.map((cat) => ({
    ...cat,
    score: cat.score ?? fallback[cat.id] ?? null,
  }));
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
  if (url && label) return `${label}: ${String(url).slice(0, 100)}`;
  if (url) return String(url).slice(0, 120);
  if (label) return String(label).slice(0, 120);
  return null;
};

const issueStatus = (
  score: number | null | undefined,
): LighthouseAuditIssue["status"] => {
  if (score == null) return "warning";
  if (score >= 0.9) return "passed";
  if (score >= 0.5) return "warning";
  return "failed";
};

/** Failed / warning audits for one Lighthouse category (SEO, Performance, …). */
export const parseCategoryAuditIssues = (
  lighthouseJson: Record<string, unknown> | null | undefined,
  categoryId: string,
): LighthouseAuditIssue[] => {
  const lhr = lighthouseJson as LighthouseReport | null;
  const category = lhr?.categories?.[categoryId];
  const audits = lhr?.audits ?? {};
  if (!category) return [];

  const issues: LighthouseAuditIssue[] = [];

  for (const ref of category.auditRefs ?? []) {
    const audit = audits[ref.id];
    if (!audit?.title) continue;
    if (
      audit.scoreDisplayMode === "informative" ||
      audit.scoreDisplayMode === "manual"
    ) {
      continue;
    }
    if (audit.score == null) continue;

    const status = issueStatus(audit.score);
    if (status === "passed") continue;

    const items = audit.details?.items ?? [];
    const locations: string[] = [];
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const line = formatItemLine(item as Record<string, unknown>);
        if (line) locations.push(line);
        if (locations.length >= 5) break;
      }
    }

    const details = audit.details as { overallSavingsMs?: number } | undefined;
    issues.push({
      id: ref.id,
      title: audit.title,
      description: audit.description ?? "",
      displayValue: audit.displayValue ?? null,
      score: audit.score ?? null,
      weight: ref.weight ?? null,
      status,
      locations,
      savingsMs:
        details?.overallSavingsMs != null
          ? Math.round(details.overallSavingsMs)
          : null,
    });
  }

  return issues.sort((a, b) => {
    const sa = a.score ?? 1;
    const sb = b.score ?? 1;
    if (sa !== sb) return sa - sb;
    return (b.weight ?? 0) - (a.weight ?? 0);
  });
};

const ratingFromScore = (score: number | null): LabMetricDetail["rating"] => {
  if (score == null) return "unknown";
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
};

/** Lab metrics with thresholds and plain-language explanation. */
export const parseLabMetricDetails = (
  lighthouseJson: Record<string, unknown> | null | undefined,
  snapshot?: {
    lab_lcp_ms?: number | null;
    lab_fcp_ms?: number | null;
    lab_cls?: number | null;
    lab_tbt_ms?: number | null;
  } | null,
): LabMetricDetail[] => {
  const lab = parseExtendedLabMetrics(lighthouseJson);
  const fcp = snapshot?.lab_fcp_ms ?? lab.fcpMs;
  const lcp = snapshot?.lab_lcp_ms ?? lab.lcpMs;
  const cls = snapshot?.lab_cls ?? lab.cls;
  const tbt = snapshot?.lab_tbt_ms ?? lab.tbtMs;

  const mk = (
    key: string,
    label: string,
    value: number | null,
    metricKey: "fcp" | "lcp" | "cls" | "tbt",
    explanation: string,
    thresholds: string,
    contributesTo: string,
  ): LabMetricDetail => {
    const score = labMetricScore(metricKey, value);
    return {
      key,
      label,
      value,
      formatted: formatLabMetric(metricKey, value),
      score,
      rating: ratingFromScore(score),
      explanation,
      thresholds,
      contributesTo,
    };
  };

  return [
    mk(
      "fcp",
      "First Contentful Paint (FCP)",
      fcp,
      "fcp",
      "Marca cuándo aparece el primer texto o imagen. Si tarda, el usuario ve pantalla en blanco.",
      "Bueno ≤1.8 s · Mejorable ≤3 s · Malo >3 s",
      "Peso directo en Performance (~10%).",
    ),
    mk(
      "lcp",
      "Largest Contentful Paint (LCP)",
      lcp,
      "lcp",
      "Cuándo carga el bloque principal (hero, foto grande). Es la métrica clave de velocidad percibida.",
      "Bueno ≤2.5 s · Mejorable ≤4 s · Malo >4 s",
      "Mayor peso en Performance (~25%) y Core Web Vitals.",
    ),
    mk(
      "tbt",
      "Total Blocking Time (TBT)",
      tbt,
      "tbt",
      "Tiempo que JavaScript bloquea clics y scroll durante la carga.",
      "Bueno ≤200 ms · Mejorable ≤600 ms · Malo >600 ms",
      "Proxy de interactividad; afecta Performance (~30%).",
    ),
    mk(
      "cls",
      "Cumulative Layout Shift (CLS)",
      cls,
      "cls",
      "Cuánto se mueve el layout mientras cargan fuentes, imágenes o banners.",
      "Bueno ≤0.1 · Mejorable ≤0.25 · Malo >0.25",
      "Core Web Vital; estabilidad visual (~25% Performance).",
    ),
    {
      key: "si",
      label: "Speed Index (SI)",
      value: lab.siMs,
      formatted: lab.siMs != null ? `${(lab.siMs / 1000).toFixed(1)} s` : "—",
      score:
        lab.siMs == null
          ? null
          : lab.siMs <= 3400
            ? 90
            : lab.siMs <= 5800
              ? 50
              : 30,
      rating: ratingFromScore(
        lab.siMs == null
          ? null
          : lab.siMs <= 3400
            ? 90
            : lab.siMs <= 5800
              ? 50
              : 30,
      ),
      explanation: "Qué tan rápido se pinta visualmente el contenido visible.",
      thresholds: "Bueno ≤3.4 s · Mejorable ≤5.8 s · Malo >5.8 s",
      contributesTo: "Performance (velocidad percibida).",
    },
    {
      key: "tti",
      label: "Time to Interactive (TTI)",
      value: lab.ttiMs,
      formatted: lab.ttiMs != null ? `${(lab.ttiMs / 1000).toFixed(1)} s` : "—",
      score: null,
      rating: "unknown",
      explanation: "Cuándo la página responde de forma fiable a interacciones.",
      thresholds: "Bueno ≤3.8 s · Mejorable ≤7.3 s · Malo >7.3 s",
      contributesTo: "Performance (interactividad).",
    },
  ];
};

export const CATEGORY_SCORE_EXPLAIN: Record<string, string> = {
  performance:
    "Promedio ponderado de métricas de carga (LCP, TBT, CLS, FCP…) y auditorías de recursos. Simula un Moto G4 en red lenta.",
  seo: "Revisa indexación, meta tags, enlaces, datos estructurados y mobile-friendly. No mide posición en Google, sino salud técnica.",
  accessibility:
    "Contraste, etiquetas, ARIA, orden de encabezados y navegación. Afecta lectores de pantalla y usuarios con discapacidad.",
  "best-practices":
    "HTTPS, consola sin errores críticos, APIs obsoletas y buenas prácticas de seguridad recomendadas por Chrome.",
};
