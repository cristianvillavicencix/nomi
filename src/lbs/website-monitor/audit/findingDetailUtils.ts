import type { AuditFinding } from "@/lbs/website-monitor/audit/types";

export type ParsedFindingDetail = {
  /** Texto del hallazgo sin la parte de ubicación. */
  problem: string | null;
  /** URLs, selectores o fragmentos HTML donde ocurre. */
  locations: string[];
  /** Primera ubicación para vista compacta. */
  locationPreview: string | null;
};

const LOCATION_MARKERS = ["Dónde:", "Ubicación:", "Ejemplos:"] as const;

const splitLocationParts = (raw: string) =>
  raw
    .split(/\s*[·|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

const extractUrls = (text: string) => {
  const matches = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;]+$/, "")))];
};

export const parseFindingDescription = (
  description?: string | null,
): ParsedFindingDetail => {
  const text = description?.trim() ?? "";
  if (!text) {
    return { problem: null, locations: [], locationPreview: null };
  }

  for (const marker of LOCATION_MARKERS) {
    const index = text.indexOf(marker);
    if (index === -1) continue;

    const problem = text.slice(0, index).trim().replace(/\s+$/, "") || null;
    const locationRaw = text.slice(index + marker.length).trim();
    const locations = splitLocationParts(locationRaw);

    return {
      problem: problem || text,
      locations,
      locationPreview: locations[0] ?? null,
    };
  }

  const urls = extractUrls(text);
  if (urls.length > 0) {
    return {
      problem: text,
      locations: urls,
      locationPreview: urls[0] ?? null,
    };
  }

  return { problem: text, locations: [], locationPreview: null };
};

export const getFindingSourceLabel = (finding: AuditFinding) => {
  const labels: Record<string, string> = {
    lighthouse: "Lighthouse",
    axe: "axe-core",
    static: "Análisis HTML",
    crux: "CrUX (usuarios reales)",
    nomi: "Nomi",
  };
  const source = labels[finding.source] ?? finding.source;
  const rule = finding.source_id?.trim();
  return rule ? `${source} · ${rule}` : source;
};

export const getStaticFindingWhereHint = (
  finding: AuditFinding,
): string | null => {
  const id = finding.source_id ?? "";
  if (id.includes("broken-links") || id.includes("broken-link")) {
    return "Enlaces en menú, footer, botones o contenido de la página";
  }
  if (id.includes("broken-images") || id.includes("images-without-alt")) {
    return "Etiquetas <img> en el HTML renderizado";
  }
  if (id.includes("title") || id.includes("meta")) {
    return "<head> del documento (meta tags)";
  }
  if (id.includes("h1") || id.includes("multiple-h1")) {
    return "Encabezados H1 visibles en la página";
  }
  if (id.includes("open-graph") || id.includes("twitter")) {
    return "Meta tags Open Graph / Twitter en <head>";
  }
  if (id.includes("structured-data") || id.includes("json-ld")) {
    return "Scripts JSON-LD en el HTML";
  }
  if (id.includes("noindex")) {
    return 'Meta robots en <head> o header HTTP "X-Robots-Tag"';
  }
  if (id.includes("viewport")) {
    return "<head> — meta viewport";
  }
  if (id.includes("robots") || id.includes("sitemap") || id.includes("llms")) {
    return "Raíz del dominio (/robots.txt, /sitemap.xml, /llms.txt)";
  }
  return null;
};

export const resolveFindingLocations = (finding: AuditFinding): string[] => {
  const parsed = parseFindingDescription(finding.description);
  if (parsed.locations.length > 0) return parsed.locations;

  const hint = getStaticFindingWhereHint(finding);
  return hint ? [hint] : [];
};

export const resolveFindingProblem = (finding: AuditFinding): string | null => {
  const parsed = parseFindingDescription(finding.description);
  if (parsed.problem) return parsed.problem;
  return finding.description?.trim() || null;
};

export type FindingFilterValue =
  | "all"
  | "critico"
  | "importante"
  | "nice-to-have"
  | `cat:${string}`;

export const buildFindingFilterOptions = (findings: AuditFinding[]) => {
  const categoryCounts: Record<string, number> = {};
  for (const f of findings) {
    categoryCounts[f.category] = (categoryCounts[f.category] ?? 0) + 1;
  }

  const severityCounts = {
    critico: findings.filter((f) => f.severity === "critico").length,
    importante: findings.filter((f) => f.severity === "importante").length,
    "nice-to-have": findings.filter((f) => f.severity === "nice-to-have")
      .length,
  };

  const categoryLabels: Record<string, string> = {
    performance: "Performance",
    seo: "SEO",
    a11y: "Accesibilidad",
    static: "Contenido",
    best_practices: "Best practices",
    security: "Seguridad",
  };

  return [
    { value: "all" as const, label: `Todos (${findings.length})` },
    {
      value: "critico" as const,
      label: `Críticos (${severityCounts.critico})`,
    },
    {
      value: "importante" as const,
      label: `Importantes (${severityCounts.importante})`,
    },
    {
      value: "nice-to-have" as const,
      label: `Menores (${severityCounts["nice-to-have"]})`,
    },
    ...Object.entries(categoryCounts).map(([cat, count]) => ({
      value: `cat:${cat}` as FindingFilterValue,
      label: `${categoryLabels[cat] ?? cat} (${count})`,
    })),
  ];
};

export const filterFindings = (
  findings: AuditFinding[],
  filter: FindingFilterValue,
) => {
  let list = findings;
  if (
    filter === "critico" ||
    filter === "importante" ||
    filter === "nice-to-have"
  ) {
    list = list.filter((f) => f.severity === filter);
  } else if (filter.startsWith("cat:")) {
    const cat = filter.slice(4);
    list = list.filter((f) => f.category === cat);
  }
  return [...list].sort((a, b) => a.display_order - b.display_order);
};

export const findingFilterFromCategory = (
  category: string | null | undefined,
): FindingFilterValue =>
  category ? (`cat:${category}` as FindingFilterValue) : "all";

export const categoryFromFindingFilter = (
  filter: FindingFilterValue,
): string | null => (filter.startsWith("cat:") ? filter.slice(4) : null);
