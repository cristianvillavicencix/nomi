import type { AuditFindingInput } from "./websiteAuditTypes.ts";

export type WebsiteAuditAiFindingInsight = {
  rank: number;
  plain_language: string;
  business_impact?: string | null;
};

export type WebsiteAuditAiMetricsNarrative = {
  overview?: string | null;
  scores?: {
    overall?: string | null;
    performance?: string | null;
    seo?: string | null;
    accessibility?: string | null;
    best_practices?: string | null;
  };
  core_web_vitals?: {
    summary?: string | null;
    lcp?: string | null;
    cls?: string | null;
    inp?: string | null;
    fcp?: string | null;
    tbt?: string | null;
  };
};

export type WebsiteAuditAiSummaryJson = {
  executive_summary: string;
  overall_health: "good" | "needs_work" | "critical";
  priority_actions: Array<{
    rank: number;
    title: string;
    why: string;
    how: string;
    impact: "high" | "medium" | "low";
    category?: string | null;
    expected_result?: string | null;
  }>;
  highlights: {
    strengths: string[];
    risks: string[];
  };
  technical_notes?: string | null;
  finding_insights?: WebsiteAuditAiFindingInsight[];
  metrics_narrative?: WebsiteAuditAiMetricsNarrative | null;
  links_narrative?: string | null;
  expected_outcomes?: Array<{
    area: string;
    recommendation: string;
    expected_result: string;
  }> | null;
  transformation_closing?: string | null;
};

type AuditRow = {
  audit_url: string;
  overall_score?: number | null;
  score_performance?: number | null;
  score_seo?: number | null;
  score_best_practices?: number | null;
  score_accessibility?: number | null;
  lab_lcp_ms?: number | null;
  lab_cls?: number | null;
  lab_tbt_ms?: number | null;
  field_lcp_ms?: number | null;
  field_cls?: number | null;
  field_inp_ms?: number | null;
  crux_has_data?: boolean | null;
  static_json?: Record<string, unknown> | null;
  mobile_snapshot?: Record<string, unknown> | null;
  desktop_snapshot?: Record<string, unknown> | null;
};

const truncate = (value: string | null | undefined, max: number) => {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const snapshotScores = (snapshot?: Record<string, unknown> | null) => ({
  overall: snapshot?.overall_score ?? null,
  performance: snapshot?.score_performance ?? null,
  seo: snapshot?.score_seo ?? null,
  best_practices: snapshot?.score_best_practices ?? null,
  accessibility: snapshot?.score_accessibility ?? null,
});

export const buildAuditContextForAi = (params: {
  audit: AuditRow;
  siteLabel?: string | null;
  findings: AuditFindingInput[];
}) => {
  const staticJson = (params.audit.static_json ?? {}) as Record<
    string,
    unknown
  >;
  const pageLinks = Array.isArray(staticJson.pageLinks)
    ? (staticJson.pageLinks as Array<Record<string, unknown>>)
    : [];
  const pageImages = Array.isArray(staticJson.pageImages)
    ? (staticJson.pageImages as Array<Record<string, unknown>>)
    : [];
  const socialLinks = Array.isArray(staticJson.socialLinks)
    ? (staticJson.socialLinks as Array<Record<string, unknown>>)
    : [];

  const sortedFindings = [...params.findings].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );

  const brokenLinks = pageLinks
    .filter((link) => link.ok === false)
    .slice(0, 12)
    .map((link) => ({
      url: truncate(String(link.url ?? ""), 200),
      status: link.status ?? null,
      text: truncate(String(link.text ?? ""), 80),
      is_internal: link.isInternal ?? null,
    }));

  const imageIssues = pageImages
    .filter((img) => img.status !== "ok")
    .slice(0, 8)
    .map((img) => ({
      src: truncate(String(img.src ?? ""), 200),
      status: img.status ?? null,
      alt: truncate(String(img.alt ?? ""), 80),
    }));

  const findings = sortedFindings.slice(0, 35).map((finding, index) => ({
    rank: index + 1,
    severity: finding.severity,
    category: finding.category,
    source: finding.source,
    source_id: finding.source_id ?? null,
    title: truncate(finding.title, 200),
    description: truncate(finding.description ?? "", 350),
    recommendation: truncate(finding.recommendation ?? "", 250),
    metric_key: finding.metric_key ?? null,
    metric_value: finding.metric_value ?? null,
  }));

  const internalLinks = pageLinks.filter(
    (link) => link.isInternal === true,
  ).length;
  const externalLinks = pageLinks.filter(
    (link) => link.isInternal === false,
  ).length;

  return {
    site_label: params.siteLabel?.trim() || null,
    url: params.audit.audit_url,
    scores: {
      combined: params.audit.overall_score ?? null,
      performance: params.audit.score_performance ?? null,
      seo: params.audit.score_seo ?? null,
      best_practices: params.audit.score_best_practices ?? null,
      accessibility: params.audit.score_accessibility ?? null,
      mobile: snapshotScores(params.audit.mobile_snapshot),
      desktop: snapshotScores(params.audit.desktop_snapshot),
    },
    lab_metrics: {
      lcp_ms: params.audit.lab_lcp_ms ?? null,
      cls: params.audit.lab_cls ?? null,
      tbt_ms: params.audit.lab_tbt_ms ?? null,
    },
    field_metrics: params.audit.crux_has_data
      ? {
          lcp_ms: params.audit.field_lcp_ms ?? null,
          cls: params.audit.field_cls ?? null,
          inp_ms: params.audit.field_inp_ms ?? null,
        }
      : null,
    static_analysis: {
      title: truncate(String(staticJson.title ?? ""), 200) || null,
      meta_description:
        truncate(String(staticJson.metaDescription ?? ""), 300) || null,
      h1_count: staticJson.h1Count ?? null,
      h1_text: truncate(String(staticJson.h1Text ?? ""), 200) || null,
      total_images: staticJson.totalImages ?? pageImages.length,
      broken_images: staticJson.brokenImages ?? null,
      images_without_alt: staticJson.imagesWithoutAlt ?? null,
      total_links: staticJson.totalPageLinks ?? pageLinks.length,
      internal_links: internalLinks,
      external_links: externalLinks,
      broken_links: staticJson.brokenLinkCount ?? brokenLinks.length,
      social_networks: socialLinks.map((s) => String(s.network ?? "")),
      has_robots_txt: staticJson.hasRobotsTxt ?? null,
      has_sitemap: staticJson.hasSitemap ?? null,
      has_llms_txt: staticJson.crawlFiles?.llmsTxt?.found ?? null,
      robots_allows_ai_crawlers:
        staticJson.crawlFiles?.robots?.allowsAiCrawlers ?? null,
      ai_seo_checklist_score:
        staticJson.crawlFiles?.aiSeoChecklist?.score ?? null,
      security_txt_found: staticJson.crawlFiles?.securityTxt?.found ?? null,
      waf_detected: staticJson.crawlFiles?.siteInfra?.waf?.detected ?? null,
      ssl_days_remaining:
        (
          staticJson.domainInfra as
            | { ssl?: { daysRemaining?: number | null } }
            | undefined
        )?.ssl?.daysRemaining ?? null,
      spf_record:
        (
          staticJson.domainInfra as
            | { emailAuth?: { spf?: boolean } }
            | undefined
        )?.emailAuth?.spf ?? null,
      dmarc_record:
        (
          staticJson.domainInfra as
            | { emailAuth?: { dmarc?: boolean } }
            | undefined
        )?.emailAuth?.dmarc ?? null,
      has_privacy_link:
        (
          staticJson.complianceSignals as
            | { hasPrivacyLink?: boolean }
            | undefined
        )?.hasPrivacyLink ?? null,
      http_status: staticJson.httpStatus ?? null,
      expanded_seo: staticJson.expandedSeo ?? null,
      technologies: (Array.isArray(staticJson.technologies)
        ? staticJson.technologies
        : []
      )
        .slice(0, 25)
        .map((tech: Record<string, unknown>) => ({
          name: String(tech.name ?? ""),
          version: tech.version ?? null,
          categories: Array.isArray(tech.categories) ? tech.categories : [],
        })),
    },
    sample_broken_links: brokenLinks,
    sample_image_issues: imageIssues,
    findings,
    findings_count: params.findings.length,
  };
};

const normalizeSummary = (
  parsed: WebsiteAuditAiSummaryJson,
): WebsiteAuditAiSummaryJson => {
  if (
    !parsed.executive_summary ||
    typeof parsed.executive_summary !== "string"
  ) {
    throw new Error("AI response missing executive_summary");
  }
  if (
    !parsed.overall_health ||
    !["good", "needs_work", "critical"].includes(parsed.overall_health)
  ) {
    throw new Error("AI response missing valid overall_health");
  }
  if (!Array.isArray(parsed.priority_actions)) {
    parsed.priority_actions = [];
  }
  if (!parsed.highlights || typeof parsed.highlights !== "object") {
    parsed.highlights = { strengths: [], risks: [] };
  }
  if (!Array.isArray(parsed.highlights.strengths)) {
    parsed.highlights.strengths = [];
  }
  if (!Array.isArray(parsed.highlights.risks)) {
    parsed.highlights.risks = [];
  }
  if (!Array.isArray(parsed.finding_insights)) {
    parsed.finding_insights = [];
  }
  if (parsed.metrics_narrative == null) {
    parsed.metrics_narrative = {};
  }
  if (typeof parsed.links_narrative !== "string") {
    parsed.links_narrative = null;
  }
  if (!Array.isArray(parsed.expected_outcomes)) {
    parsed.expected_outcomes = [];
  }
  if (typeof parsed.transformation_closing !== "string") {
    parsed.transformation_closing = null;
  }
  return parsed;
};

const extractJsonFromText = (text: string): WebsiteAuditAiSummaryJson => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  return normalizeSummary(JSON.parse(candidate) as WebsiteAuditAiSummaryJson);
};

export const generateWebsiteAuditAiSummary = async (
  context: ReturnType<typeof buildAuditContextForAi>,
): Promise<WebsiteAuditAiSummaryJson> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model =
    Deno.env.get("ANTHROPIC_MODEL")?.trim() || "claude-sonnet-4-20250514";

  const systemPrompt = `Eres un consultor senior de sitios web para agencias digitales en español (Latinoamérica).
Analiza el JSON del audit y produce contenido útil para clientes NO técnicos.
REGLAS ESTRICTAS:
- Usa SOLO datos presentes en el JSON. No inventes métricas, URLs ni hallazgos.
- Si falta un dato, indícalo como "no disponible" u omítelo.
- Lenguaje claro, cercano y profesional (evita jerga sin explicar).
- Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra):
{
  "executive_summary": "2-4 párrafos",
  "overall_health": "good" | "needs_work" | "critical",
  "priority_actions": [
    { "rank": 1, "title": "...", "why": "...", "how": "...", "impact": "high"|"medium"|"low", "category": "performance|seo|a11y|static|best_practices", "expected_result": "Qué logra el negocio al implementar esta acción (resultado concreto, no técnico)" }
  ],
  "highlights": { "strengths": ["..."], "risks": ["..."] },
  "technical_notes": "opcional o null",
  "finding_insights": [
    { "rank": 1, "plain_language": "Qué significa este hallazgo para alguien sin conocimientos técnicos", "business_impact": "Por qué importa al negocio" }
  ],
  "expected_outcomes": [
    { "area": "Velocidad|SEO|Confianza|Conversiones|Visibilidad", "recommendation": "Resumen de qué hay que hacer", "expected_result": "Qué obtiene el cliente al lograrlo (beneficio medible o perceptible)" }
  ],
  "transformation_closing": "2-3 oraciones finales: después de aplicar las mejoras prioritarias, el sitio logrará... (visión clara del estado final deseado)",
  "metrics_narrative": {
    "overview": "Resumen general de scores en lenguaje natural",
    "scores": {
      "overall": "...",
      "performance": "...",
      "seo": "...",
      "accessibility": "...",
      "best_practices": "..."
    },
    "core_web_vitals": {
      "summary": "Qué significan las métricas de velocidad para el visitante",
      "lcp": "Interpretación del LCP con el valor del JSON si existe",
      "cls": "Interpretación del CLS",
      "inp": "Interpretación del INP de campo si existe",
      "fcp": "Interpretación del FCP si aplica",
      "tbt": "Interpretación del TBT si aplica"
    }
  },
  "links_narrative": "Párrafo sobre salud de enlaces (rotos, internos vs externos) basado en el JSON"
}
IMPORTANTE:
- finding_insights: un objeto por cada hallazgo en findings[] usando el mismo rank (1..N).
- metrics_narrative: explica scores 0-100 y ms de métricas como los entendería un dueño de negocio.
- expected_outcomes: 3-5 objetos agrupando las mejoras por área de negocio (no por hallazgo técnico). Cada expected_result debe responder "¿qué gano yo?" en lenguaje de resultados.
- transformation_closing: cierre inspirador pero realista basado solo en los datos del audit.
- priority_actions.expected_result: obligatorio en cada acción — el beneficio concreto de completarla.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Anthropic API error (${res.status})${detail ? `: ${detail.slice(0, 400)}` : ""}`,
    );
  }

  const payload = await res.json();
  const textBlock = (payload.content ?? []).find(
    (block: { type?: string }) => block.type === "text",
  );
  const text = textBlock?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty response from Anthropic");
  }

  return extractJsonFromText(text);
};

export const triggerWebsiteAuditSummarize = (auditId: number) => {
  const secret = Deno.env.get("WEB_AUDIT_WORKER_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
  if (!secret || !supabaseUrl) return;

  fetch(`${supabaseUrl}/functions/v1/website_audit_summarize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audit_id: auditId }),
  }).catch((err) => console.error("triggerWebsiteAuditSummarize", err));
};
