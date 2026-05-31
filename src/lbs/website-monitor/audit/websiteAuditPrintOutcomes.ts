import type {
  AuditFinding,
  WebsiteAudit,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { countFindingsBySeverity } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";

export type PrintExpectedOutcome = {
  area: string;
  recommendation: string;
  expectedResult: string;
};

const CATEGORY_OUTCOME: Record<
  string,
  { area: string; expectedResult: string }
> = {
  performance: {
    area: "Velocidad y experiencia",
    expectedResult:
      "Páginas que cargan más rápido, menos visitantes que abandonan antes de ver tu oferta y mejor percepción de profesionalismo.",
  },
  seo: {
    area: "Visibilidad en Google",
    expectedResult:
      "Mayor probabilidad de aparecer en búsquedas relevantes, más clics orgánicos y más oportunidades de contacto sin pagar anuncios.",
  },
  a11y: {
    area: "Accesibilidad",
    expectedResult:
      "Un sitio usable por más personas (incluidos móvil y lectores de pantalla), mejor imagen de marca y menos fricción al navegar.",
  },
  static: {
    area: "Contenido y confianza",
    expectedResult:
      "Mensaje más claro para visitantes y buscadores, mayor credibilidad y más conversiones desde la primera impresión.",
  },
  best_practices: {
    area: "Seguridad y calidad técnica",
    expectedResult:
      "Sitio más confiable, menos errores visibles y mejor compatibilidad con navegadores y herramientas de Google.",
  },
};

const buildFallbackOutcomes = (
  findings: AuditFinding[],
  aiSummary?: WebsiteAuditAiSummaryJson | null,
): PrintExpectedOutcome[] => {
  const fromActions = (aiSummary?.priority_actions ?? [])
    .filter((a) => a.expected_result?.trim())
    .slice(0, 5)
    .map((a) => ({
      area: a.title,
      recommendation: a.how?.trim() || a.why?.trim() || a.title,
      expectedResult: a.expected_result!.trim(),
    }));

  if (fromActions.length >= 3) return fromActions;

  const categories = new Set(findings.map((f) => f.category));
  const outcomes: PrintExpectedOutcome[] = [];

  for (const cat of categories) {
    const template = CATEGORY_OUTCOME[cat];
    if (!template) continue;
    const catFindings = findings.filter((f) => f.category === cat);
    const top =
      catFindings.find((f) => f.severity === "critico") ?? catFindings[0];
    outcomes.push({
      area: template.area,
      recommendation:
        top?.recommendation?.trim() ||
        top?.title ||
        "Corregir los hallazgos detectados en esta área.",
      expectedResult: template.expectedResult,
    });
  }

  if (outcomes.length === 0 && (aiSummary?.priority_actions.length ?? 0) > 0) {
    return aiSummary!.priority_actions.slice(0, 4).map((a) => ({
      area: a.title,
      recommendation: a.how?.trim() || a.why,
      expectedResult:
        a.expected_result?.trim() ||
        "Mejora medible en la experiencia del visitante y en cómo Google evalúa tu sitio.",
    }));
  }

  return outcomes.slice(0, 5);
};

export const getPrintExpectedOutcomes = (
  findings: AuditFinding[],
  aiSummary?: WebsiteAuditAiSummaryJson | null,
): PrintExpectedOutcome[] => {
  const fromAi = aiSummary?.expected_outcomes?.filter(
    (o) => o.area?.trim() && o.expected_result?.trim(),
  );

  if (fromAi && fromAi.length > 0) {
    return fromAi.map((o) => ({
      area: o.area.trim(),
      recommendation:
        o.recommendation?.trim() ||
        "Implementar las mejoras indicadas en este reporte.",
      expectedResult: o.expected_result.trim(),
    }));
  }

  return buildFallbackOutcomes(findings, aiSummary);
};

export const getPrintTransformationClosing = (
  audit: WebsiteAudit,
  findings: AuditFinding[],
  aiSummary?: WebsiteAuditAiSummaryJson | null,
  siteLabel?: string,
): string => {
  const closing = aiSummary?.transformation_closing?.trim();
  if (closing) return closing;

  const label = siteLabel ?? audit.audit_url;
  const counts = countFindingsBySeverity(findings);
  const score = audit.overall_score;

  if (score != null && score >= 90 && counts.critico === 0) {
    return `Con las optimizaciones menores sugeridas, ${label} puede consolidarse como un sitio de referencia: rápido, confiable y bien posicionado. El objetivo no es solo mantener el score, sino convertir ese tráfico en más consultas y ventas.`;
  }

  if (counts.critico > 0) {
    return `Al resolver primero los ${counts.critico} problema(s) crítico(s) y luego las mejoras importantes, ${label} pasará de "funciona con fricción" a un sitio que carga bien en celular, transmite confianza y compite mejor en Google. Eso se traduce en más visitas que se quedan, más formularios completados y más oportunidades de negocio.`;
  }

  return `Implementando las recomendaciones de este reporte, ${label} ganará velocidad, claridad y visibilidad. Un sitio optimizado no es un fin técnico: es la base para que más personas te encuentren, confíen en tu marca y den el siguiente paso (llamar, escribir o comprar).`;
};

export const getPrintActionExpectedResult = (
  action: WebsiteAuditAiSummaryJson["priority_actions"][number],
): string => {
  if (action.expected_result?.trim()) return action.expected_result.trim();
  const cat = action.category ?? "";
  return (
    CATEGORY_OUTCOME[cat]?.expectedResult ??
    "Mejor experiencia para tus visitantes y señales más positivas para Google."
  );
};

export const getPrintRoadmapPhases = (findings: AuditFinding[]) => {
  const counts = countFindingsBySeverity(findings);
  return [
    {
      phase: "Fase 1 · Urgente",
      timeline: "1–2 semanas",
      focus: `${counts.critico} problema(s) crítico(s)`,
      result: "Eliminar lo que hoy frena Google y espanta visitantes en móvil.",
    },
    {
      phase: "Fase 2 · Importante",
      timeline: "2–4 semanas",
      focus: `${counts.importante} mejora(s) importante(s)`,
      result:
        "Subir puntuaciones, reducir errores visibles y reforzar confianza.",
    },
    {
      phase: "Fase 3 · Optimización",
      timeline: "Continuo",
      focus: `${counts["nice-to-have"]} detalle(s) menor(es)`,
      result:
        "Afinar contenido, SEO y rendimiento para sostener resultados a largo plazo.",
    },
  ];
};
