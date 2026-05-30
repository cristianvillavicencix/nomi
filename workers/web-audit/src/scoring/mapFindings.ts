import type { AuditFindingInput, LighthouseScores, StaticAnalysisResult } from "../types.js";

const pushFinding = (
  findings: AuditFindingInput[],
  finding: AuditFindingInput,
) => {
  findings.push(finding);
};

export const mapStaticFindings = (
  staticResult: StaticAnalysisResult,
): AuditFindingInput[] => {
  const findings: AuditFindingInput[] = [];
  let order = 0;

  if (!staticResult.title) {
    pushFinding(findings, {
      category: "static",
      severity: "importante",
      source: "static",
      source_id: "missing-title",
      title: "Falta etiqueta title",
      description: "La página no tiene un elemento <title>.",
      recommendation: "Agrega un title descriptivo con la marca y servicio principal.",
      display_order: order++,
    });
  }

  if (!staticResult.metaDescription) {
    pushFinding(findings, {
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "missing-meta-description",
      title: "Falta meta description",
      description: "No se encontró meta name=\"description\".",
      recommendation: "Escribe una descripción de 120–160 caracteres orientada a conversión.",
      display_order: order++,
    });
  }

  if (staticResult.h1Count === 0) {
    pushFinding(findings, {
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "missing-h1",
      title: "Sin H1 en la home",
      description: "No hay un encabezado H1 visible.",
      recommendation: "Usa un H1 claro con el servicio principal y la ciudad/metro.",
      display_order: order++,
    });
  }

  if (!staticResult.viewport) {
    pushFinding(findings, {
      category: "static",
      severity: "critico",
      source: "static",
      source_id: "missing-viewport",
      title: "Sin viewport mobile",
      description: "Falta meta viewport; el sitio puede verse mal en móvil.",
      recommendation: "Agrega meta viewport width=device-width para móvil.",
      display_order: order++,
    });
  }

  if (staticResult.imagesWithoutAlt > 0) {
    pushFinding(findings, {
      category: "a11y",
      severity: "importante",
      source: "static",
      source_id: "images-without-alt",
      title: "Imágenes sin texto alternativo",
      description: `${staticResult.imagesWithoutAlt} de ${staticResult.totalImages} imágenes sin alt.`,
      recommendation: "Agrega alt descriptivo en imágenes de servicio, equipo y proyectos.",
      metric_key: "images_without_alt",
      metric_value: String(staticResult.imagesWithoutAlt),
      display_order: order++,
    });
  }

  if (!staticResult.hasRobotsTxt) {
    pushFinding(findings, {
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-robots-txt",
      title: "robots.txt no encontrado",
      description: "No se pudo obtener /robots.txt.",
      recommendation: "Publica robots.txt básico apuntando al sitemap.",
      display_order: order++,
    });
  }

  if (!staticResult.hasSitemap) {
    pushFinding(findings, {
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "missing-sitemap",
      title: "sitemap.xml no encontrado",
      description: "No se pudo obtener /sitemap.xml.",
      recommendation: "Genera y envía un sitemap XML a Google Search Console.",
      display_order: order++,
    });
  }

  return findings;
};

export const mapLighthouseFindings = (
  lighthouse: LighthouseScores,
): AuditFindingInput[] => {
  const findings: AuditFindingInput[] = [];
  let order = 100;

  if (lighthouse.performance != null && lighthouse.performance < 50) {
    pushFinding(findings, {
      category: "performance",
      severity: "critico",
      source: "lighthouse",
      source_id: "performance-score",
      title: "Performance muy baja",
      description: `Score Lighthouse performance: ${lighthouse.performance}/100.`,
      recommendation: "Optimiza imágenes, JS/CSS y hosting para mejorar carga móvil.",
      metric_key: "performance_score",
      metric_value: String(lighthouse.performance),
      display_order: order++,
    });
  }

  if (lighthouse.labLcpMs != null && lighthouse.labLcpMs > 4000) {
    pushFinding(findings, {
      category: "performance",
      severity: "critico",
      source: "lighthouse",
      source_id: "lcp",
      title: "LCP lento en laboratorio",
      description: `Largest Contentful Paint ≈ ${Math.round(lighthouse.labLcpMs)} ms.`,
      recommendation: "Reduce peso del hero y mejora el servidor/CDN.",
      metric_key: "lcp_ms",
      metric_value: `${Math.round(lighthouse.labLcpMs)}ms`,
      display_order: order++,
    });
  }

  if (lighthouse.seo != null && lighthouse.seo < 80) {
    pushFinding(findings, {
      category: "seo",
      severity: "importante",
      source: "lighthouse",
      source_id: "seo-score",
      title: "SEO técnico mejorable",
      description: `Score Lighthouse SEO: ${lighthouse.seo}/100.`,
      recommendation: "Corrige meta tags, indexación y datos estructurados básicos.",
      metric_key: "seo_score",
      metric_value: String(lighthouse.seo),
      display_order: order++,
    });
  }

  return findings;
};

export const mergeFindings = (
  staticResult: StaticAnalysisResult,
  lighthouse: LighthouseScores,
  axeFindings: AuditFindingInput[] = [],
) => [
  ...mapStaticFindings(staticResult),
  ...mapLighthouseFindings(lighthouse),
  ...axeFindings,
];

const prefixFindings = (
  findings: AuditFindingInput[],
  label: string,
  orderOffset: number,
): AuditFindingInput[] =>
  findings.map((finding, index) => ({
    ...finding,
    title: finding.title.startsWith("[") ? finding.title : `[${label}] ${finding.title}`,
    display_order: orderOffset + index,
  }));

/** Unified report: static once + mobile lab + desktop lab. */
export const mergeUnifiedFindings = (
  staticResult: StaticAnalysisResult,
  mobileLh: LighthouseScores,
  mobileAxe: AuditFindingInput[],
  desktopLh: LighthouseScores,
  desktopAxe: AuditFindingInput[],
): AuditFindingInput[] => [
  ...mapStaticFindings(staticResult),
  ...prefixFindings(mapLighthouseFindings(mobileLh), "Móvil", 100),
  ...prefixFindings(mobileAxe, "Móvil", 200),
  ...prefixFindings(mapLighthouseFindings(desktopLh), "Desktop", 300),
  ...prefixFindings(desktopAxe, "Desktop", 400),
];

/** Mobile-first combined score (70% mobile, 30% desktop). */
export const combineOverallScore = (
  mobile: number | null | undefined,
  desktop: number | null | undefined,
): number | null => {
  if (mobile != null && desktop != null) {
    return Math.round(mobile * 0.7 + desktop * 0.3);
  }
  return mobile ?? desktop ?? null;
};
