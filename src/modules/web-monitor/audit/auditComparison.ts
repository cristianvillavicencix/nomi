import type { AuditFinding, StaticAnalysisJson, WebsiteAudit } from "./types";
import { snapshotScores } from "./auditUtils";

export type AuditComparisonMetric = {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
};

export type AuditComparisonFindingChange = {
  sourceId: string;
  title: string;
  change: "new" | "resolved";
  severity: string;
};

export type AuditComparisonResult = {
  hasPrevious: boolean;
  metrics: AuditComparisonMetric[];
  newFindings: AuditComparisonFindingChange[];
  resolvedFindings: AuditComparisonFindingChange[];
  crawlChanges: Array<{ label: string; before: string; after: string }>;
};

const crawlStatusLabel = (found?: boolean, access?: string) => {
  if (found) return "Encontrado";
  if (access === "blocked") return "Bloqueado";
  return "No encontrado";
};

const compareCrawlFiles = (
  current?: StaticAnalysisJson["crawlFiles"],
  previous?: StaticAnalysisJson["crawlFiles"],
) => {
  const changes: AuditComparisonResult["crawlChanges"] = [];
  if (!current || !previous) return changes;

  const pairs: Array<
    [
      string,
      { found: boolean; access?: string } | undefined,
      { found: boolean; access?: string } | undefined,
    ]
  > = [
    ["robots.txt", current.robots, previous.robots],
    ["sitemap", current.sitemap, previous.sitemap],
    ["llms.txt", current.llmsTxt, previous.llmsTxt],
    ["security.txt", current.securityTxt, previous.securityTxt],
  ];

  for (const [label, cur, prev] of pairs) {
    if (!cur || !prev) continue;
    const before = crawlStatusLabel(prev.found, prev.access);
    const after = crawlStatusLabel(cur.found, cur.access);
    if (before !== after) {
      changes.push({ label, before, after });
    }
  }

  return changes;
};

export const buildAuditComparison = (
  current: WebsiteAudit,
  previous: WebsiteAudit | null | undefined,
  currentFindings: AuditFinding[],
  previousFindings: AuditFinding[],
): AuditComparisonResult => {
  if (!previous || previous.status !== "done") {
    return {
      hasPrevious: false,
      metrics: [],
      newFindings: [],
      resolvedFindings: [],
      crawlChanges: [],
    };
  }

  const curSnap = snapshotScores(current);
  const prevSnap = snapshotScores(previous);

  const metricDefs: Array<{ key: keyof typeof curSnap; label: string }> = [
    { key: "overall", label: "Global" },
    { key: "performance", label: "Performance" },
    { key: "seo", label: "SEO" },
    { key: "bestPractices", label: "Best Practices" },
    { key: "accessibility", label: "Accesibilidad" },
  ];

  const metrics: AuditComparisonMetric[] = metricDefs.map(({ key, label }) => {
    const currentVal = curSnap[key] ?? null;
    const previousVal = prevSnap[key] ?? null;
    return {
      key,
      label,
      current: currentVal,
      previous: previousVal,
      delta:
        currentVal != null && previousVal != null
          ? currentVal - previousVal
          : null,
    };
  });

  const prevIds = new Set(
    previousFindings.map((f) => f.source_id ?? f.title).filter(Boolean),
  );
  const curIds = new Set(
    currentFindings.map((f) => f.source_id ?? f.title).filter(Boolean),
  );

  const newFindings: AuditComparisonFindingChange[] = currentFindings
    .filter((f) => {
      const id = f.source_id ?? f.title;
      return id && !prevIds.has(id);
    })
    .slice(0, 12)
    .map((f) => ({
      sourceId: f.source_id ?? f.title,
      title: f.title,
      change: "new" as const,
      severity: f.severity,
    }));

  const resolvedFindings: AuditComparisonFindingChange[] = previousFindings
    .filter((f) => {
      const id = f.source_id ?? f.title;
      return id && !curIds.has(id);
    })
    .slice(0, 12)
    .map((f) => ({
      sourceId: f.source_id ?? f.title,
      title: f.title,
      change: "resolved" as const,
      severity: f.severity,
    }));

  const crawlChanges = compareCrawlFiles(
    current.static_json as StaticAnalysisJson | undefined,
    previous.static_json as StaticAnalysisJson | undefined,
  );

  return {
    hasPrevious: true,
    metrics,
    newFindings,
    resolvedFindings,
    crawlChanges,
  };
};
