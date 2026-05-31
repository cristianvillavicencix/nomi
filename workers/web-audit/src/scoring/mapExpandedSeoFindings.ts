import type { AuditFindingInput, StaticAnalysisResult } from "../types.js";

const seoAuditContext = (staticResult: StaticAnalysisResult): string => {
  const seo = staticResult.expandedSeo;
  const arch = seo?.pageArchitecture ?? staticResult.pageArchitecture;
  if (!arch?.frameworks.length) return "";

  const mode = seo?.analysisMode;
  const stack = arch.frameworks.join(", ");
  if (mode === "rendered") {
    return ` Evaluado en DOM renderizado (${stack}).`;
  }
  if (mode === "embedded") {
    return ` Inferido de JSON embebido (${stack}).`;
  }
  if (arch.renderingModel !== "static") {
    return ` Stack detectado: ${stack}.`;
  }
  return "";
};

const renderedBasis = (staticResult: StaticAnalysisResult) =>
  staticResult.expandedSeo?.analysisMode === "rendered"
    ? " en el DOM renderizado"
    : "";

export const mapExpandedSeoFindings = (
  staticResult: StaticAnalysisResult,
  orderStart = 0,
): AuditFindingInput[] => {
  const seo = staticResult.expandedSeo;
  if (!seo) return [];

  const findings: AuditFindingInput[] = [];
  let order = orderStart;
  const ctx = seoAuditContext(staticResult);
  const dom = renderedBasis(staticResult);

  if (seo.noindex) {
    findings.push({
      category: "seo",
      severity: "critico",
      source: "static",
      source_id: "noindex",
      title: "La página tiene noindex",
      description:
        `meta robots incluye noindex; los buscadores no deberían indexar esta URL.${ctx}`,
      recommendation:
        "Quita noindex en páginas que quieras posicionar. Resérvalo para staging o thank-you pages.",
      display_order: order++,
    });
  }

  if (seo.titleLengthStatus === "short" && staticResult.title) {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "title-too-short",
      title: "Title demasiado corto",
      description: `El title tiene ${seo.titleLength} caracteres (ideal 30–60).${ctx}`,
      recommendation: "Amplía el title con servicio + ubicación + marca.",
      metric_key: "title_length",
      metric_value: String(seo.titleLength),
      display_order: order++,
    });
  }

  if (seo.titleLengthStatus === "long" && staticResult.title) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "title-too-long",
      title: "Title demasiado largo",
      description: `El title tiene ${seo.titleLength} caracteres (ideal 30–60).${ctx}`,
      recommendation: "Acorta el title para que no se corte en Google.",
      metric_key: "title_length",
      metric_value: String(seo.titleLength),
      display_order: order++,
    });
  }

  if (seo.metaDescriptionLengthStatus === "short" && staticResult.metaDescription) {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "meta-too-short",
      title: "Meta description corta",
      description: `${seo.metaDescriptionLength} caracteres (ideal 120–160).`,
      recommendation: "Escribe un snippet persuasivo con beneficio y CTA.",
      metric_key: "meta_description_length",
      metric_value: String(seo.metaDescriptionLength),
      display_order: order++,
    });
  }

  if (seo.metaDescriptionLengthStatus === "long" && staticResult.metaDescription) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "meta-too-long",
      title: "Meta description larga",
      description: `${seo.metaDescriptionLength} caracteres (ideal 120–160).`,
      recommendation: "Recorta la meta para evitar truncado en resultados.",
      metric_key: "meta_description_length",
      metric_value: String(seo.metaDescriptionLength),
      display_order: order++,
    });
  }

  if (seo.multipleH1) {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "multiple-h1",
      title: "Múltiples H1 en la página",
      description: `Se encontraron ${staticResult.h1Count} etiquetas H1.${seo.h1Texts.length ? ` Textos: ${seo.h1Texts.slice(0, 3).join(" · ")}` : ""}`,
      recommendation: "Usa un solo H1 principal; el resto como H2/H3.",
      metric_key: "h1_count",
      metric_value: String(staticResult.h1Count),
      display_order: order++,
    });
  }

  if (!seo.openGraph.complete) {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "incomplete-open-graph",
      title: "Open Graph incompleto",
      description: `Faltan: ${seo.openGraph.missingRequired.join(", ")}.`,
      recommendation:
        "Completa og:title, og:description, og:image, og:url y og:type para compartir en redes.",
      display_order: order++,
    });
  }

  if (!seo.twitterCard.complete && !seo.openGraph.complete) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "incomplete-twitter-card",
      title: "Twitter Card incompleta",
      description: `Faltan: ${seo.twitterCard.missingRecommended.join(", ")}.`,
      recommendation: "Agrega twitter:card y metadatos para previews en X/Twitter.",
      display_order: order++,
    });
  }

  if (!seo.hasStructuredData) {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "missing-structured-data",
      title: "Sin datos estructurados (JSON-LD)",
      description: `No se detectó script application/ld+json${dom}.`,
      recommendation:
        "Agrega LocalBusiness, Organization o WebSite schema según el tipo de negocio.",
      display_order: order++,
    });
  }

  if (!seo.htmlLang) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-html-lang",
      title: "Falta lang en <html>",
      description: "No hay atributo lang en el elemento html.",
      recommendation: 'Define lang="es" (o el idioma principal del sitio).',
      display_order: order++,
    });
  }

  if (seo.hreflang.length > 0 && seo.hreflang.length < 2) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "hreflang-partial",
      title: "hreflang detectado (revisar)",
      description: `${seo.hreflang.length} alternativa(s) hreflang encontrada(s).`,
      recommendation:
        "Si el sitio es multi-idioma, incluye hreflang recíproco y x-default.",
      display_order: order++,
    });
  }

  return findings;
};
