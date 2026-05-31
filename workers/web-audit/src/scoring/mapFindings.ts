import type { AuditFindingInput, LighthouseScores, StaticAnalysisResult } from "../types.js";
import { mapDetailedLighthouseFindings } from "./mapDetailedLighthouseFindings.js";
import { mapExpandedSeoFindings } from "./mapExpandedSeoFindings.js";
import { mapAiSeoFindings } from "./mapAiSeoFindings.js";
import { mapDomainInfraFindings } from "./mapDomainInfraFindings.js";

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
  const ctx = (() => {
    const seo = staticResult.expandedSeo;
    const arch = seo?.pageArchitecture ?? staticResult.pageArchitecture;
    if (!arch?.frameworks.length) return "";
    const stack = arch.frameworks.join(", ");
    if (seo?.analysisMode === "rendered") {
      return ` (Verificado en DOM renderizado · ${stack})`;
    }
    return arch.renderingModel !== "static" ? ` (Stack: ${stack})` : "";
  })();

  if (!staticResult.title) {
    pushFinding(findings, {
      category: "static",
      severity: "importante",
      source: "static",
      source_id: "missing-title",
      title: "Falta etiqueta title",
      description: `La página no tiene un elemento <title>${staticResult.expandedSeo?.analysisMode === "rendered" ? " ni en el DOM renderizado" : ""}.${ctx}`,
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
      description: `No se encontró meta name="description"${staticResult.expandedSeo?.analysisMode === "rendered" ? " en el DOM renderizado" : ""}.${ctx}`,
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
      description: `No hay un encabezado H1 visible${staticResult.expandedSeo?.analysisMode === "rendered" ? " tras ejecutar JavaScript" : ""}.${ctx}`,
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
    const examples = (staticResult.pageImages ?? staticResult.imagesMissingAlt ?? [])
      .filter((img) => "status" in img ? img.status === "missing_alt" : true)
      .slice(0, 4)
      .map((img) => img.filename ?? img.src.split("/").pop()?.split("?")[0] ?? img.src)
      .filter(Boolean);
    pushFinding(findings, {
      category: "a11y",
      severity: "importante",
      source: "static",
      source_id: "images-without-alt",
      title: "Imágenes sin texto alternativo",
      description: `${staticResult.imagesWithoutAlt} de ${staticResult.totalImages} imágenes sin atributo alt.${examples.length ? ` Dónde: ${examples.join(" · ")}.` : ""}`,
      recommendation:
        "En cada <img> agrega alt descriptivo (servicio, proyecto, equipo). Decorativas: alt=\"\".",
      metric_key: "images_without_alt",
      metric_value: String(staticResult.imagesWithoutAlt),
      display_order: order++,
    });
  }

  if ((staticResult.brokenImages ?? 0) > 0) {
    const examples = (staticResult.pageImages ?? [])
      .filter((img) => img.status === "broken")
      .slice(0, 4)
      .map((img) => img.src.slice(0, 100));
    pushFinding(findings, {
      category: "static",
      severity: "importante",
      source: "static",
      source_id: "broken-images",
      title: "Imágenes rotas o que no cargan",
      description: `${staticResult.brokenImages} imagen(es) no cargaron en el navegador.${examples.length ? ` Dónde: ${examples.join(" · ")}` : ""}`,
      recommendation:
        "Corrige rutas, sube de nuevo el archivo o reemplaza URLs en el CMS/plantilla.",
      metric_key: "broken_images",
      metric_value: String(staticResult.brokenImages),
      display_order: order++,
    });
  }

  if ((staticResult.brokenLinkCount ?? 0) > 0) {
    const examples = (staticResult.pageLinks ?? [])
      .filter((link) => !link.ok)
      .slice(0, 5)
      .map((link) => {
        const status = link.status != null ? `HTTP ${link.status}` : "error";
        return `${link.text ? `${link.text} → ` : ""}${link.url} (${status})`;
      });
    pushFinding(findings, {
      category: "static",
      severity: "importante",
      source: "static",
      source_id: "broken-links",
      title: "Enlaces rotos en la página",
      description: `${staticResult.brokenLinkCount} enlace(s) fallaron (${staticResult.checkedLinkCount ?? 0} verificados de ${staticResult.totalPageLinks ?? 0}).${examples.length ? ` Dónde: ${examples.join(" · ")}` : ""}`,
      recommendation:
        "Actualiza o elimina enlaces rotos en menús, footer y botones CTA.",
      metric_key: "broken_links",
      metric_value: String(staticResult.brokenLinkCount),
      display_order: order++,
    });
  }

  if (!staticResult.hasRobotsTxt) {
    const robots = staticResult.crawlFiles?.robots;
    const blocked = robots?.access === "blocked";
    pushFinding(findings, {
      category: "seo",
      severity: blocked ? "importante" : "nice-to-have",
      source: "static",
      source_id: blocked ? "robots-txt-blocked" : "missing-robots-txt",
      title: blocked ? "robots.txt bloqueado por WAF" : "robots.txt no encontrado",
      description: blocked
        ? `El fetch automático recibió HTTP ${robots?.fetchStatus ?? robots?.status ?? 403} en ${robots?.url ?? "/robots.txt"}. El archivo puede existir pero estar bloqueado para bots del datacenter.`
        : robots?.url
          ? `No se pudo obtener ${robots.url}.`
          : "No se pudo obtener /robots.txt.",
      recommendation: blocked
        ? "Permite acceso a robots.txt para crawlers SEO (Googlebot) y herramientas de auditoría, o verifica el archivo manualmente en el navegador."
        : "Publica robots.txt básico apuntando al sitemap.",
      display_order: order++,
    });
  }

  if (!staticResult.hasSitemap) {
    const sitemap = staticResult.crawlFiles?.sitemap;
    const blocked = sitemap?.access === "blocked";
    const tried = sitemap?.candidatesTried?.length;
    pushFinding(findings, {
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: blocked ? "sitemap-blocked" : "missing-sitemap",
      title: blocked ? "Sitemap bloqueado por WAF" : "sitemap.xml no encontrado",
      description: blocked
        ? `Rutas estándar bloqueadas (HTTP ${sitemap?.fetchStatus ?? sitemap?.status ?? 403})${tried ? ` · ${tried} rutas probadas` : ""}.`
        : sitemap?.url
          ? `No se pudo obtener ${sitemap.url}${tried ? ` (${tried} rutas probadas)` : ""}.`
          : "No se pudo obtener /sitemap.xml.",
      recommendation: blocked
        ? "Asegura que sitemap.xml (o wp-sitemap.xml) sea accesible para Googlebot; revisa reglas WAF/CDN."
        : "Genera y envía un sitemap XML a Google Search Console.",
      display_order: order++,
    });
  }

  const expandedStart = order;
  const expandedFindings = mapExpandedSeoFindings(staticResult, expandedStart);
  findings.push(...expandedFindings);
  order += expandedFindings.length;

  const aiFindings = mapAiSeoFindings(staticResult, order);
  findings.push(...aiFindings);
  order += aiFindings.length;

  const domainFindings = mapDomainInfraFindings(staticResult, order);
  findings.push(...domainFindings);

  if (staticResult.staticFetchRecovered) {
    pushFinding(findings, {
      category: "static",
      severity: "nice-to-have",
      source: "nomi",
      source_id: "waf-bypass-browser",
      title: "WAF detectado — audit vía navegador",
      description: `El servidor bloqueó el fetch automático del worker (HTTP ${staticResult.httpStatus ?? 403}). El reporte se generó con Chrome headless; los resultados son válidos pero el hosting puede limitar bots y crawlers SEO.`,
      recommendation:
        "Revisa Cloudflare / Sucuri / Wordfence: permite Googlebot y tu herramienta de monitoreo si quieres audits sin fricción.",
      display_order: order++,
    });
  }

  return findings;
};

export const mapLighthouseFindings = (
  lighthouse: LighthouseScores,
  deviceLabel = "Lab",
): AuditFindingInput[] => {
  const detailed = mapDetailedLighthouseFindings(
    lighthouse.lighthouseJson,
    deviceLabel,
    100,
  );
  if (detailed.length > 0) return detailed;

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
  ...mapLighthouseFindings(lighthouse, "Lab"),
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
  ...mapLighthouseFindings(mobileLh, "Móvil"),
  ...prefixFindings(mobileAxe, "Móvil", 200),
  ...mapLighthouseFindings(desktopLh, "Desktop"),
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
