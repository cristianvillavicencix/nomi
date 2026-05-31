import { isEmptyAppShell, type PageArchitecture } from "./pageArchitecture.js";
import type { RenderedSeoSignals } from "./extractRenderedSeo.js";

export type SeoBasics = {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  canonical: string | null;
};

export type SeoAuditStrategy = {
  preferRendered: boolean;
  analysisMode: "static" | "rendered" | "embedded";
  auditReason: string;
};

const scoreBasics = (basics: SeoBasics | null | undefined): number => {
  if (!basics) return 0;
  let score = 0;
  if (basics.title?.trim()) score += 3;
  if (basics.metaDescription?.trim()) score += 2;
  if (basics.h1Count > 0) score += 2;
  if (basics.h1Text?.trim()) score += 1;
  if (basics.canonical?.trim()) score += 1;
  return score;
};

const fromRendered = (rendered: RenderedSeoSignals): SeoBasics => ({
  title: rendered.title,
  metaDescription: rendered.metaDescription,
  h1Count: rendered.h1Count,
  h1Text: rendered.h1Text,
  canonical: rendered.canonical,
});

export const resolveSeoAuditStrategy = (params: {
  architecture: PageArchitecture;
  staticBasics: SeoBasics;
  embedded: SeoBasics | null;
  rendered: RenderedSeoSignals | null;
  staticHtml: string;
}): SeoAuditStrategy => {
  const { architecture, staticBasics, embedded, rendered, staticHtml } = params;

  const staticScore = scoreBasics(staticBasics);
  const embeddedScore = scoreBasics(embedded);
  const renderedBasics = rendered ? fromRendered(rendered) : null;
  const renderedScore = scoreBasics(renderedBasics);

  const emptyShell = isEmptyAppShell(staticHtml);
  const stackLabel =
    architecture.frameworks.length > 0
      ? architecture.frameworks.join(", ")
      : architecture.platformCategory;

  if (rendered && emptyShell && renderedScore > 0) {
    return {
      preferRendered: true,
      analysisMode: "rendered",
      auditReason: `HTML inicial vacío (shell ${stackLabel}); SEO tomado del DOM renderizado.`,
    };
  }

  if (
    rendered &&
    renderedScore > staticScore &&
    renderedScore >= embeddedScore
  ) {
    return {
      preferRendered: true,
      analysisMode: "rendered",
      auditReason: `DOM renderizado con más señales SEO que el HTML inicial (${stackLabel}).`,
    };
  }

  if (
    rendered &&
    staticScore === 0 &&
    renderedScore > 0 &&
    (architecture.renderingModel !== "static" || emptyShell)
  ) {
    return {
      preferRendered: true,
      analysisMode: "rendered",
      auditReason: `Sitio dinámico (${stackLabel}); contenido SEO visible tras JavaScript.`,
    };
  }

  if (
    architecture.seoAuditBasis === "rendered_dom" &&
    rendered &&
    renderedScore >= staticScore
  ) {
    return {
      preferRendered: true,
      analysisMode: "rendered",
      auditReason: `Stack ${stackLabel} evaluado en DOM renderizado.`,
    };
  }

  if (embedded && embeddedScore > staticScore && embeddedScore >= renderedScore) {
    return {
      preferRendered: false,
      analysisMode: "embedded",
      auditReason: `SEO inferido de JSON embebido (${stackLabel}).`,
    };
  }

  if (architecture.platformCategory === "cms" && staticScore >= renderedScore) {
    return {
      preferRendered: false,
      analysisMode: "static",
      auditReason: `CMS (${stackLabel}) con HTML server-rendered completo.`,
    };
  }

  return {
    preferRendered: false,
    analysisMode: "static",
    auditReason:
      staticScore > 0
        ? `HTML inicial completo (${stackLabel || "sitio estático"}).`
        : `Análisis en HTML inicial; stack: ${stackLabel || "no detectado"}.`,
  };
};

export const mergeSeoBasics = (params: {
  strategy: SeoAuditStrategy;
  staticBasics: SeoBasics;
  embedded: SeoBasics | null;
  rendered: RenderedSeoSignals | null;
}): SeoBasics => {
  const { strategy, staticBasics, embedded, rendered } = params;
  const preferRendered = strategy.preferRendered && Boolean(rendered);

  const pick = (
    renderedVal: string | null | undefined,
    embeddedVal: string | null | undefined,
    staticVal: string | null | undefined,
  ) => {
    if (preferRendered) {
      return renderedVal?.trim() || embeddedVal?.trim() || staticVal?.trim() || null;
    }
    if (strategy.analysisMode === "embedded") {
      return embeddedVal?.trim() || staticVal?.trim() || renderedVal?.trim() || null;
    }
    return staticVal?.trim() || embeddedVal?.trim() || renderedVal?.trim() || null;
  };

  const h1Count = preferRendered && rendered
    ? rendered.h1Count
    : Math.max(
        staticBasics.h1Count,
        embedded?.h1Count ?? 0,
        rendered?.h1Count ?? 0,
      );

  const h1Text = preferRendered && rendered?.h1Text
    ? rendered.h1Text
    : staticBasics.h1Text ?? embedded?.h1Text ?? rendered?.h1Text ?? null;

  return {
    title: pick(rendered?.title, embedded?.title, staticBasics.title),
    metaDescription: pick(
      rendered?.metaDescription,
      embedded?.metaDescription,
      staticBasics.metaDescription,
    ),
    h1Count,
    h1Text,
    canonical: pick(rendered?.canonical, embedded?.canonical, staticBasics.canonical),
  };
};
