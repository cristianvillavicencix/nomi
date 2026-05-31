import type { CSSProperties, ReactNode } from "react";
import type {
  AuditFinding,
  StaticAnalysisJson,
  WebsiteAudit,
} from "@/lbs/website-monitor/audit/types";
import {
  getAuditSnapshots,
  snapshotScores,
} from "@/lbs/website-monitor/audit/auditUtils";
import { buildAuditComparison } from "@/lbs/website-monitor/audit/auditComparison";
import { formatLabMetric } from "@/lbs/website-monitor/audit/labMetricUtils";
import { WEB_AUDIT_PDF_ROOT_ID } from "@/lbs/website-monitor/audit/websiteAuditPdfExport";
import {
  PRINT_AGENCY_LOGO,
  PRINT_AGENCY_NAME,
  PRINT_REPORT_LABEL,
  printAgencyLogoStyle,
  printPageStyle,
  printTheme,
  scoreColor,
  scoreLabelPlain,
} from "@/lbs/website-monitor/audit/websiteAuditPrintTheme";
import {
  buildFindingInsightMap,
  countFindingsBySeverity,
  getHealthHeadline,
  getMetricsNarrative,
  getResumenOverview,
} from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import {
  getPrintActionExpectedResult,
  getPrintExpectedOutcomes,
  getPrintRoadmapPhases,
  getPrintTransformationClosing,
} from "@/lbs/website-monitor/audit/websiteAuditPrintOutcomes";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";
import {
  getSocialLinkLabel,
  normalizeSocialUrl,
} from "@/lbs/clients/clientSocialLinks";

const SEVERITY_ORDER = ["critico", "importante", "nice-to-have"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  critico: "Crítico",
  importante: "Importante",
  "nice-to-have": "Menor",
};
const SEVERITY_COLORS: Record<string, string> = {
  critico: printTheme.red,
  importante: printTheme.amber,
  "nice-to-have": printTheme.muted,
};
const SEVERITY_BG: Record<string, string> = {
  critico: printTheme.redSoft,
  importante: printTheme.amberSoft,
  "nice-to-have": printTheme.surface,
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Velocidad",
  seo: "SEO (Google)",
  accessibility: "Accesibilidad",
  "best-practices": "Buenas prácticas",
  static: "Contenido",
  a11y: "Accesibilidad",
};

const CWV_HINTS: Record<string, string> = {
  fcp: "Cuándo aparece lo primero en pantalla",
  lcp: "Cuándo carga la parte principal (ideal < 2.5 s)",
  cls: "Si el contenido salta al cargar",
  tbt: "Si la página se siente lenta al tocar",
};

const HEALTH_BADGE: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  good: {
    label: "Buen estado",
    bg: printTheme.greenSoft,
    color: printTheme.green,
  },
  needs_work: {
    label: "Requiere mejoras",
    bg: printTheme.amberSoft,
    color: printTheme.amber,
  },
  critical: {
    label: "Atención urgente",
    bg: printTheme.redSoft,
    color: printTheme.red,
  },
};

const PrintPage = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <section className="web-audit-pdf-page" style={printPageStyle(style)}>
    {children}
  </section>
);

const PrintSectionTitle = ({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) => (
  <div style={{ marginBottom: 16 }}>
    <h2
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: printTheme.text,
        margin: 0,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
    {subtitle ? (
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 12,
          color: printTheme.muted,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    ) : null}
    <div
      style={{
        marginTop: 10,
        height: 3,
        width: 48,
        borderRadius: 999,
        background: `linear-gradient(90deg, ${printTheme.brand}, ${printTheme.brandMid})`,
      }}
    />
  </div>
);

const PrintAgencyLogo = ({
  width,
  style,
}: {
  width: number;
  style?: CSSProperties;
}) => (
  <img
    src={PRINT_AGENCY_LOGO}
    alt={PRINT_AGENCY_NAME}
    loading="eager"
    decoding="sync"
    style={{ ...printAgencyLogoStyle(width), ...style }}
  />
);

const PrintPageHeader = ({ siteLabel }: { siteLabel: string }) => (
  <header
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 28,
      paddingBottom: 12,
      borderBottom: `1px solid ${printTheme.border}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <PrintAgencyLogo width={132} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: printTheme.brand }}>
          {PRINT_AGENCY_NAME}
        </div>
        <div style={{ fontSize: 10, color: printTheme.muted }}>
          {PRINT_REPORT_LABEL}
        </div>
      </div>
    </div>
    <div
      style={{
        fontSize: 10,
        color: printTheme.faint,
        textAlign: "right",
        maxWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, color: printTheme.textSoft }}>
        {siteLabel}
      </div>
      <div style={{ marginTop: 2 }}>Reporte de salud web</div>
    </div>
  </header>
);

const PrintPageFooter = ({ generatedAt }: { generatedAt: string }) => (
  <footer
    style={{
      marginTop: "auto",
      paddingTop: 20,
      borderTop: `1px solid ${printTheme.border}`,
      fontSize: 10,
      color: printTheme.faint,
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
    }}
  >
    <span>Preparado por {PRINT_AGENCY_NAME}</span>
    <span>{generatedAt}</span>
  </footer>
);

const PrintScoreRing = ({
  label,
  value,
  size = 56,
  subtitle,
}: {
  label: string;
  value?: number | null;
  size?: number;
  subtitle?: string;
}) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        width: size,
        height: size,
        margin: "0 auto 8px",
        borderRadius: "50%",
        border: `4px solid ${value != null ? scoreColor(value) : printTheme.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size >= 80 ? 28 : 16,
        color: scoreColor(value),
        lineHeight: 1,
      }}
    >
      {value != null ? value : "—"}
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, color: printTheme.textSoft }}>
      {label}
    </div>
    {subtitle ? (
      <div style={{ fontSize: 10, color: printTheme.muted, marginTop: 2 }}>
        {subtitle}
      </div>
    ) : null}
  </div>
);

const PrintLabMetric = ({
  label,
  hint,
  metric,
  value,
}: {
  label: string;
  hint: string;
  metric: "fcp" | "lcp" | "cls" | "tbt";
  value?: number | null;
}) => (
  <div
    style={{
      border: `1px solid ${printTheme.border}`,
      borderRadius: 12,
      padding: 14,
      background: printTheme.white,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: printTheme.muted,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: printTheme.text,
        marginBottom: 6,
      }}
    >
      {formatLabMetric(metric, value)}
    </div>
    <div style={{ fontSize: 10, color: printTheme.muted, lineHeight: 1.45 }}>
      {hint}
    </div>
  </div>
);

const PrintAiBox = ({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) => (
  <div
    style={{
      borderRadius: 12,
      border: `1px solid ${printTheme.brandBorder}`,
      background: printTheme.brandSoft,
      padding: 16,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: printTheme.brand,
        marginBottom: 8,
      }}
    >
      {title ?? "Interpretación IA"}
    </div>
    <div style={{ fontSize: 12, lineHeight: 1.6, color: printTheme.textSoft }}>
      {children}
    </div>
  </div>
);

const PrintStatCard = ({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) => (
  <div
    style={{
      flex: 1,
      borderRadius: 12,
      border: `1px solid ${printTheme.border}`,
      background: bg,
      padding: "16px 14px",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 600, color: printTheme.muted }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 36,
        fontWeight: 800,
        color,
        marginTop: 4,
        lineHeight: 1,
      }}
    >
      {count}
    </div>
  </div>
);

const TocItem = ({
  n,
  title,
  desc,
}: {
  n: number;
  title: string;
  desc: string;
}) => (
  <div
    style={{
      display: "flex",
      gap: 14,
      padding: "12px 0",
      borderBottom: `1px solid ${printTheme.border}`,
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: printTheme.brandSoft,
        color: printTheme.brand,
        fontWeight: 700,
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {n}
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: printTheme.text }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: printTheme.muted,
          marginTop: 2,
          lineHeight: 1.45,
        }}
      >
        {desc}
      </div>
    </div>
  </div>
);

export const WebsiteAuditPrintDocument = ({
  audit,
  findings,
  siteLabel,
  previousAudit,
  previousFindings = [],
}: {
  audit: WebsiteAudit;
  findings: AuditFinding[];
  siteLabel?: string;
  previousAudit?: WebsiteAudit | null;
  previousFindings?: AuditFinding[];
}) => {
  const { mobile, desktop } = getAuditSnapshots(audit);
  const mobileScores = snapshotScores(mobile);
  const desktopScores = snapshotScores(desktop);
  const comparison = buildAuditComparison(
    audit,
    previousAudit,
    findings,
    previousFindings,
  );
  const staticJson = (audit.static_json ?? {}) as StaticAnalysisJson;
  const label = siteLabel ?? audit.audit_url;
  const generatedAt = formatCheckedAt(audit.completed_at ?? audit.requested_at);
  const aiSummary = audit.ai_summary_json ?? null;
  const metricsNarrative = getMetricsNarrative(aiSummary);
  const headline = getHealthHeadline(aiSummary);
  const overview = getResumenOverview(aiSummary);
  const severityCounts = countFindingsBySeverity(findings);
  const findingInsights = buildFindingInsightMap(findings, aiSummary);
  const healthBadge = aiSummary?.overall_health
    ? HEALTH_BADGE[aiSummary.overall_health]
    : null;

  const sortedFindings = [...findings].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(
      a.severity as (typeof SEVERITY_ORDER)[number],
    );
    const sb = SEVERITY_ORDER.indexOf(
      b.severity as (typeof SEVERITY_ORDER)[number],
    );
    if (sa !== sb) return sa - sb;
    return a.display_order - b.display_order;
  });

  const priorityActions = aiSummary?.priority_actions?.slice(0, 6) ?? [];
  const brokenLinks = (staticJson.pageLinks ?? [])
    .filter((link) => !link.ok)
    .slice(0, 15);
  const expectedOutcomes = getPrintExpectedOutcomes(findings, aiSummary);
  const transformationClosing = getPrintTransformationClosing(
    audit,
    findings,
    aiSummary,
    label,
  );
  const roadmapPhases = getPrintRoadmapPhases(findings);

  return (
    <div
      id={WEB_AUDIT_PDF_ROOT_ID}
      className="web-audit-pdf-document"
      style={{
        width: printTheme.pageWidth,
        maxWidth: printTheme.pageWidth,
        margin: "0 auto",
        background: printTheme.white,
        color: printTheme.text,
        fontFamily: printTheme.font,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {/* ── Portada ── */}
      <PrintPage
        style={{
          minHeight: 1050,
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${printTheme.brand} 0%, ${printTheme.brandMid} 100%)`,
            padding: "36px 48px 52px",
            color: printTheme.white,
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: printTheme.white,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 32,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            }}
          >
            <PrintAgencyLogo width={220} />
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              opacity: 0.95,
            }}
          >
            {PRINT_AGENCY_NAME.toUpperCase()} ·{" "}
            {PRINT_REPORT_LABEL.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              opacity: 0.85,
              marginTop: 4,
            }}
          >
            REPORTE DE SALUD WEB
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              margin: "8px 0 6px",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {label}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              opacity: 0.9,
              wordBreak: "break-all",
            }}
          >
            {audit.audit_url}
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 11, opacity: 0.8 }}>
            Generado el {generatedAt} · Análisis móvil + escritorio
          </p>
        </div>

        <div
          style={{
            padding: "32px 48px 24px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {audit.overall_score != null ? (
            <div
              style={{
                display: "flex",
                gap: 28,
                alignItems: "center",
                marginBottom: 28,
                flexWrap: "wrap",
              }}
            >
              <PrintScoreRing
                label="Puntuación general"
                value={audit.overall_score}
                size={96}
                subtitle={`${scoreLabelPlain(audit.overall_score)} · 70% móvil, 30% desktop`}
              />
              <div style={{ flex: 1, minWidth: 220 }}>
                {healthBadge ? (
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: healthBadge.bg,
                      color: healthBadge.color,
                      marginBottom: 10,
                    }}
                  >
                    {healthBadge.label}
                  </span>
                ) : null}
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    margin: "0 0 8px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {headline ?? "Resumen de tu sitio web"}
                </h2>
                {overview ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: printTheme.textSoft,
                      lineHeight: 1.6,
                    }}
                  >
                    {overview}
                  </p>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: printTheme.muted,
                      lineHeight: 1.6,
                    }}
                  >
                    Este reporte mide qué tan rápido, visible y confiable es tu
                    sitio para visitantes y para Google. Los números van de 0 a
                    100 — mientras más alto, mejor.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            <PrintStatCard
              label="Problemas críticos"
              count={severityCounts.critico}
              color={printTheme.red}
              bg={printTheme.redSoft}
            />
            <PrintStatCard
              label="Mejoras importantes"
              count={severityCounts.importante}
              color={printTheme.amber}
              bg={printTheme.amberSoft}
            />
            <PrintStatCard
              label="Detalles menores"
              count={severityCounts["nice-to-have"]}
              color={printTheme.green}
              bg={printTheme.greenSoft}
            />
          </div>

          <div
            style={{
              borderRadius: 12,
              border: `1px dashed ${printTheme.border}`,
              background: printTheme.surface,
              padding: 16,
              marginTop: "auto",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: printTheme.text,
                marginBottom: 8,
              }}
            >
              ¿Para quién es este documento?
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: printTheme.muted,
                lineHeight: 1.55,
              }}
            >
              Está escrito para dueños de negocio, marketing y equipos no
              técnicos. Cada sección explica qué significa el dato, qué hacer al
              respecto y qué lograrás al implementarlo. Al final encontrarás una
              hoja de ruta y la visión del sitio optimizado.
            </p>
          </div>
        </div>
      </PrintPage>

      {/* ── Guía + índice ── */}
      <PrintPage
        style={{ minHeight: 1050, display: "flex", flexDirection: "column" }}
      >
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Antes de profundizar, estas son las reglas básicas para leer las puntuaciones.">
          Cómo leer este reporte
        </PrintSectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            {
              range: "90 – 100",
              label: "Excelente",
              color: printTheme.green,
              desc: "Tu sitio está muy bien en esta área.",
            },
            {
              range: "50 – 89",
              label: "Mejorable",
              color: printTheme.amber,
              desc: "Funciona, pero hay margen de mejora visible.",
            },
            {
              range: "0 – 49",
              label: "Urgente",
              color: printTheme.red,
              desc: "Afecta experiencia, conversiones o visibilidad.",
            },
          ].map((item) => (
            <div
              key={item.range}
              style={{
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 14,
                borderTop: `4px solid ${item.color}`,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>
                {item.range}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: printTheme.muted,
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>

        <PrintSectionTitle subtitle="Contenido del documento en orden sugerido de lectura.">
          Qué incluye
        </PrintSectionTitle>
        <TocItem
          n={1}
          title="Resumen ejecutivo"
          desc="Lo más importante en lenguaje claro: fortalezas, riesgos y plan de acción."
        />
        <TocItem
          n={2}
          title="Puntuaciones por dispositivo"
          desc="Comparación móvil vs escritorio en velocidad, SEO y buenas prácticas."
        />
        <TocItem
          n={3}
          title="Velocidad de carga"
          desc="Métricas de experiencia real al abrir tu sitio (Core Web Vitals)."
        />
        <TocItem
          n={4}
          title="Contenido y SEO básico"
          desc="Título, descripción y elementos que Google lee primero."
        />
        <TocItem
          n={5}
          title="Hallazgos y recomendaciones"
          desc={`${sortedFindings.length} punto(s) detectados, ordenados por prioridad.`}
        />
        {priorityActions.length > 0 ? (
          <TocItem
            n={6}
            title="Plan de acción prioritario"
            desc="Qué hacer, en qué orden, y qué obtienes al completar cada paso."
          />
        ) : null}
        <TocItem
          n={priorityActions.length > 0 ? 7 : 6}
          title="Qué lograrás al implementar"
          desc="Resultados concretos para tu negocio: más visibilidad, confianza y conversiones."
        />
        <TocItem
          n={priorityActions.length > 0 ? 8 : 7}
          title="Conclusión y próximos pasos"
          desc="Visión final del sitio optimizado y hoja de ruta sugerida."
        />

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Resumen ejecutivo IA ── */}
      {(aiSummary?.executive_summary ||
        (aiSummary?.highlights.strengths.length ?? 0) > 0 ||
        (aiSummary?.highlights.risks.length ?? 0) > 0) && (
        <PrintPage
          style={{ minHeight: 1050, display: "flex", flexDirection: "column" }}
        >
          <PrintPageHeader siteLabel={label} />
          <PrintSectionTitle subtitle="Síntesis generada con IA a partir de los datos reales de este análisis.">
            Resumen ejecutivo
          </PrintSectionTitle>

          {aiSummary?.executive_summary ? (
            <div style={{ marginBottom: 20 }}>
              {aiSummary.executive_summary
                .split(/\n\n+/)
                .map((paragraph, index) => (
                  <p
                    key={index}
                    style={{
                      margin: index === 0 ? 0 : "12px 0 0",
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: printTheme.textSoft,
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
            </div>
          ) : null}

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {(aiSummary?.highlights.strengths.length ?? 0) > 0 ? (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid #a7f3d0`,
                  background: printTheme.greenSoft,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: printTheme.green,
                    marginBottom: 10,
                  }}
                >
                  Lo que funciona bien
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {aiSummary!.highlights.strengths.map((item, i) => (
                    <li
                      key={i}
                      style={{ marginBottom: 6, color: printTheme.textSoft }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(aiSummary?.highlights.risks.length ?? 0) > 0 ? (
              <div
                style={{
                  borderRadius: 12,
                  border: `1px solid #fecaca`,
                  background: printTheme.redSoft,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: printTheme.red,
                    marginBottom: 10,
                  }}
                >
                  Riesgos a atender
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {aiSummary!.highlights.risks.map((item, i) => (
                    <li
                      key={i}
                      style={{ marginBottom: 6, color: printTheme.textSoft }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {comparison.hasPrevious ? (
            <div
              style={{
                marginTop: 24,
                borderRadius: 12,
                border: `1px solid ${printTheme.border}`,
                padding: 16,
                background: printTheme.surface,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                Cambios vs reporte anterior
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                }}
              >
                {comparison.metrics.map((metric) => (
                  <div key={metric.key} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: printTheme.muted }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {metric.current ?? "—"}
                    </div>
                    {metric.delta != null ? (
                      <div
                        style={{
                          fontSize: 10,
                          color:
                            metric.delta >= 0
                              ? printTheme.green
                              : printTheme.red,
                        }}
                      >
                        {metric.delta >= 0 ? `+${metric.delta}` : metric.delta}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <PrintPageFooter generatedAt={generatedAt} />
        </PrintPage>
      )}

      {/* ── Puntuaciones ── */}
      <PrintPage style={{ display: "flex", flexDirection: "column" }}>
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Google prioriza la experiencia móvil. El score combinado pesa 70% móvil y 30% escritorio.">
          Puntuación por categoría
        </PrintSectionTitle>

        {metricsNarrative?.scores?.overall?.trim() ? (
          <div style={{ marginBottom: 20 }}>
            <PrintAiBox>{metricsNarrative.scores.overall}</PrintAiBox>
          </div>
        ) : null}

        {[
          { title: "Móvil", scores: mobileScores },
          { title: "Escritorio (Desktop)", scores: desktopScores },
        ].map(({ title, scores }) => (
          <div
            key={title}
            style={{
              border: `1px solid ${printTheme.border}`,
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
              {title}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              <PrintScoreRing
                label="Global"
                value={scores.overall}
                subtitle={scoreLabelPlain(scores.overall)}
              />
              <PrintScoreRing
                label="Velocidad"
                value={scores.performance}
                subtitle={scoreLabelPlain(scores.performance)}
              />
              <PrintScoreRing
                label="SEO"
                value={scores.seo}
                subtitle={scoreLabelPlain(scores.seo)}
              />
              <PrintScoreRing
                label="Buenas prácticas"
                value={scores.bestPractices}
                subtitle={scoreLabelPlain(scores.bestPractices)}
              />
            </div>
          </div>
        ))}

        {metricsNarrative?.scores ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {(
              [
                ["performance", "Velocidad"],
                ["seo", "SEO"],
                ["accessibility", "Accesibilidad"],
                ["best_practices", "Buenas prácticas"],
              ] as const
            ).map(([key, labelKey]) => {
              const text = metricsNarrative.scores?.[key]?.trim();
              if (!text) return null;
              return (
                <div
                  key={key}
                  style={{
                    border: `1px solid ${printTheme.border}`,
                    borderRadius: 10,
                    padding: 12,
                    background: printTheme.surface,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: printTheme.brand,
                      marginBottom: 4,
                    }}
                  >
                    {labelKey}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: printTheme.textSoft,
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Velocidad ── */}
      <PrintPage style={{ display: "flex", flexDirection: "column" }}>
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Estas métricas miden qué tan rápido y estable se siente tu sitio al abrirlo — especialmente en celular.">
          Velocidad de carga
        </PrintSectionTitle>

        {metricsNarrative?.core_web_vitals?.summary?.trim() ? (
          <div style={{ marginBottom: 20 }}>
            <PrintAiBox title="Qué significa para tu negocio">
              {metricsNarrative.core_web_vitals.summary}
            </PrintAiBox>
          </div>
        ) : null}

        {[
          { title: "Móvil", scores: mobileScores },
          { title: "Escritorio", scores: desktopScores },
        ].map(({ title, scores }) => (
          <div key={title} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              {title}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
              }}
            >
              <PrintLabMetric
                label="Primera pintura (FCP)"
                hint={
                  metricsNarrative?.core_web_vitals?.fcp?.trim() ||
                  CWV_HINTS.fcp
                }
                metric="fcp"
                value={scores.labFcpMs}
              />
              <PrintLabMetric
                label="Carga principal (LCP)"
                hint={
                  metricsNarrative?.core_web_vitals?.lcp?.trim() ||
                  CWV_HINTS.lcp
                }
                metric="lcp"
                value={scores.labLcpMs}
              />
              <PrintLabMetric
                label="Estabilidad (CLS)"
                hint={
                  metricsNarrative?.core_web_vitals?.cls?.trim() ||
                  CWV_HINTS.cls
                }
                metric="cls"
                value={scores.labCls}
              />
              <PrintLabMetric
                label="Respuesta (TBT)"
                hint={
                  metricsNarrative?.core_web_vitals?.tbt?.trim() ||
                  CWV_HINTS.tbt
                }
                metric="tbt"
                value={scores.labTbtMs}
              />
            </div>
          </div>
        ))}

        {audit.crux_has_data ? (
          <div
            style={{
              borderRadius: 10,
              background: printTheme.surface,
              padding: 12,
              fontSize: 11,
              color: printTheme.muted,
            }}
          >
            <strong style={{ color: printTheme.textSoft }}>
              Datos reales de visitantes (CrUX):
            </strong>
            {audit.field_lcp_ms != null
              ? ` LCP ${Math.round(Number(audit.field_lcp_ms))} ms`
              : ""}
            {audit.field_cls != null
              ? ` · CLS ${Number(audit.field_cls).toFixed(3)}`
              : ""}
            {audit.field_inp_ms != null
              ? ` · INP ${Math.round(Number(audit.field_inp_ms))} ms`
              : ""}
            <span style={{ display: "block", marginTop: 4 }}>
              CrUX refleja la experiencia de usuarios reales en Chrome, no solo
              una prueba de laboratorio.
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: printTheme.muted, margin: 0 }}>
            Sin datos de campo CrUX (tráfico insuficiente en Chrome para este
            sitio o página).
          </p>
        )}

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Contenido ── */}
      <PrintPage style={{ display: "flex", flexDirection: "column" }}>
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Lo que Google y los visitantes ven primero en los resultados de búsqueda.">
          Contenido y SEO básico
        </PrintSectionTitle>

        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          <div
            style={{
              border: `1px solid ${printTheme.border}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: printTheme.muted,
                marginBottom: 6,
              }}
            >
              TÍTULO DE LA PÁGINA
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {staticJson.title ?? "—"}
            </div>
            <div
              style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
            >
              Aparece como titular en Google. Debe describir tu negocio con
              claridad.
            </div>
          </div>
          <div
            style={{
              border: `1px solid ${printTheme.border}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: printTheme.muted,
                marginBottom: 6,
              }}
            >
              META DESCRIPCIÓN
            </div>
            <div style={{ fontSize: 12, color: printTheme.textSoft }}>
              {staticJson.metaDescription ?? "—"}
            </div>
            <div
              style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
            >
              Texto bajo el título en Google. Invita a hacer clic si está bien
              escrito.
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div
              style={{
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: printTheme.muted,
                  marginBottom: 6,
                }}
              >
                ENCABEZADO PRINCIPAL (H1)
              </div>
              <div style={{ fontSize: 12 }}>{staticJson.h1Text ?? "—"}</div>
              <div
                style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
              >
                {staticJson.h1Count ?? 0} H1 detectado(s) — lo ideal es uno solo
                por página.
              </div>
            </div>
            <div
              style={{
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: printTheme.muted,
                  marginBottom: 6,
                }}
              >
                IMÁGENES
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {staticJson.totalImages ?? 0}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: printTheme.muted,
                  }}
                >
                  {" "}
                  total
                </span>
              </div>
              <div
                style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
              >
                {staticJson.imagesOk ?? 0} OK ·{" "}
                {staticJson.imagesWithoutAlt ?? 0} sin texto alt ·{" "}
                {staticJson.brokenImages ?? 0} rotas
              </div>
            </div>
          </div>
        </div>

        {staticJson.crawlFiles ? (
          <>
            <PrintSectionTitle subtitle="Archivos que ayudan a Google a rastrear e indexar tu sitio.">
              Archivos de rastreo
            </PrintSectionTitle>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
                marginBottom: 16,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${printTheme.border}`,
                    color: printTheme.muted,
                  }}
                >
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>
                    Archivo
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>
                    Estado
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>
                    Para qué sirve
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    [
                      "robots.txt",
                      staticJson.crawlFiles.robots,
                      "Indica qué puede indexar Google",
                    ],
                    [
                      "sitemap",
                      staticJson.crawlFiles.sitemap,
                      "Lista las páginas importantes",
                    ],
                    [
                      "llms.txt",
                      staticJson.crawlFiles.llmsTxt,
                      "Guía para crawlers de IA",
                    ],
                    [
                      "security.txt",
                      staticJson.crawlFiles.securityTxt,
                      "Contacto de seguridad",
                    ],
                  ] as const
                )
                  .filter((row) => row[1])
                  .map(([name, file, purpose]) => {
                    const snap = file as { found?: boolean; access?: string };
                    const status = snap.found
                      ? "Encontrado"
                      : snap.access === "blocked"
                        ? "Bloqueado"
                        : "No encontrado";
                    return (
                      <tr
                        key={name}
                        style={{
                          borderBottom: `1px solid ${printTheme.surface}`,
                        }}
                      >
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                          {name}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{status}</td>
                        <td
                          style={{
                            padding: "8px 10px",
                            color: printTheme.muted,
                          }}
                        >
                          {purpose}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        ) : null}

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Hallazgos ── */}
      <PrintPage style={{ display: "flex", flexDirection: "column" }}>
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Cada punto incluye qué hacer y qué ganas al resolverlo — ordenados del más urgente al menos prioritario.">
          Hallazgos y recomendaciones
        </PrintSectionTitle>

        {sortedFindings.length === 0 ? (
          <p style={{ color: printTheme.muted }}>
            Sin hallazgos registrados en este análisis.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sortedFindings.map((finding) => {
              const insight = findingInsights.get(finding.id);
              return (
                <li
                  key={finding.id}
                  style={{
                    border: `1px solid ${printTheme.border}`,
                    borderLeft: `4px solid ${SEVERITY_COLORS[finding.severity] ?? printTheme.muted}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 10,
                    breakInside: "avoid",
                    pageBreakInside: "avoid",
                    background:
                      SEVERITY_BG[finding.severity] ?? printTheme.white,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: printTheme.white,
                        background:
                          SEVERITY_COLORS[finding.severity] ?? printTheme.muted,
                        borderRadius: 4,
                        padding: "2px 8px",
                      }}
                    >
                      {SEVERITY_LABELS[finding.severity] ?? finding.severity}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: printTheme.muted,
                        border: `1px solid ${printTheme.border}`,
                        borderRadius: 4,
                        padding: "2px 8px",
                      }}
                    >
                      {CATEGORY_LABELS[finding.category] ?? finding.category}
                    </span>
                  </div>
                  <strong style={{ fontSize: 13, display: "block" }}>
                    {finding.title}
                  </strong>
                  {insight?.plain_language ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: printTheme.textSoft,
                      }}
                    >
                      {insight.plain_language}
                    </p>
                  ) : finding.description ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: printTheme.textSoft,
                        fontSize: 12,
                      }}
                    >
                      {finding.description}
                    </p>
                  ) : null}
                  {finding.recommendation ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 11,
                        color: printTheme.textSoft,
                      }}
                    >
                      <strong>Recomendación:</strong> {finding.recommendation}
                    </p>
                  ) : null}
                  {insight?.business_impact || finding.recommendation ? (
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 8,
                        border: `1px solid #a7f3d0`,
                        background: printTheme.greenSoft,
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: printTheme.green,
                          marginBottom: 4,
                        }}
                      >
                        Qué obtienes al resolverlo
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: printTheme.textSoft,
                        }}
                      >
                        {insight?.business_impact ??
                          "Menos fricción para visitantes y señales más positivas para Google."}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Plan de acción ── */}
      {priorityActions.length > 0 ? (
        <PrintPage style={{ display: "flex", flexDirection: "column" }}>
          <PrintPageHeader siteLabel={label} />
          <PrintSectionTitle subtitle="Cada acción responde tres preguntas: por qué importa, qué hacer, y qué logras al terminarla.">
            Plan de acción prioritario
          </PrintSectionTitle>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 1fr 1.2fr",
              gap: 8,
              padding: "8px 10px",
              background: printTheme.surface,
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: printTheme.muted,
              marginBottom: 8,
            }}
          >
            <span>#</span>
            <span>Recomendación</span>
            <span>Cómo implementarlo</span>
            <span>Qué obtienes</span>
          </div>

          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {priorityActions.map((action) => (
              <li
                key={action.rank}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 1fr 1.2fr",
                  gap: 8,
                  padding: "12px 10px",
                  borderBottom: `1px solid ${printTheme.border}`,
                  breakInside: "avoid",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: printTheme.brandSoft,
                    color: printTheme.brand,
                    fontWeight: 800,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {action.rank}
                </div>
                <div>
                  <div
                    style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}
                  >
                    {action.title}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: printTheme.muted,
                      lineHeight: 1.45,
                    }}
                  >
                    {action.why}
                  </p>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: printTheme.textSoft,
                    lineHeight: 1.45,
                  }}
                >
                  {action.how}
                </p>
                <div
                  style={{
                    borderRadius: 8,
                    border: `1px solid #a7f3d0`,
                    background: printTheme.greenSoft,
                    padding: "8px 10px",
                    fontSize: 10,
                    lineHeight: 1.45,
                    color: printTheme.textSoft,
                  }}
                >
                  {getPrintActionExpectedResult(action)}
                </div>
              </li>
            ))}
          </ol>

          <PrintPageFooter generatedAt={generatedAt} />
        </PrintPage>
      ) : null}

      {/* ── Enlaces y redes ── */}
      {(staticJson.pageLinks?.length ?? 0) > 0 ||
      (staticJson.socialLinks?.length ?? 0) > 0 ? (
        <PrintPage style={{ display: "flex", flexDirection: "column" }}>
          <PrintPageHeader siteLabel={label} />
          <PrintSectionTitle subtitle="Enlaces rotos afectan confianza y SEO. Las redes sociales refuerzan tu presencia de marca.">
            Enlaces y presencia social
          </PrintSectionTitle>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Enlaces en la página (
              {staticJson.totalPageLinks ?? staticJson.pageLinks?.length ?? 0})
            </div>
            <p
              style={{
                fontSize: 11,
                color: printTheme.muted,
                margin: "0 0 10px",
              }}
            >
              {staticJson.brokenLinkCount ?? 0} rotos ·{" "}
              {staticJson.checkedLinkCount ?? staticJson.pageLinks?.length ?? 0}{" "}
              verificados
            </p>
            {brokenLinks.length === 0 ? (
              <p
                style={{
                  fontSize: 11,
                  color: printTheme.green,
                  fontWeight: 600,
                }}
              >
                No se detectaron enlaces rotos en la muestra analizada.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {brokenLinks.map((link) => (
                  <li
                    key={link.url}
                    style={{
                      border: `1px solid #fecaca`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      marginBottom: 8,
                      fontSize: 11,
                      background: printTheme.redSoft,
                    }}
                  >
                    <strong style={{ color: printTheme.red }}>
                      {link.status != null ? `HTTP ${link.status}` : "Error"}
                    </strong>
                    {link.text ? (
                      <div style={{ marginTop: 2 }}>{link.text}</div>
                    ) : null}
                    <div
                      style={{
                        color: printTheme.brand,
                        marginTop: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {link.url}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(staticJson.socialLinks?.length ?? 0) > 0 ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                Redes sociales ({staticJson.socialLinks?.length ?? 0})
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(staticJson.socialLinks ?? []).map((link) => {
                  const href = normalizeSocialUrl(link.url);
                  const socialLabel = getSocialLinkLabel(link);
                  return (
                    <li
                      key={`${link.network}-${href}`}
                      style={{
                        border: `1px solid ${printTheme.border}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                        marginBottom: 8,
                        fontSize: 11,
                      }}
                    >
                      <strong>{socialLabel}</strong>
                      <div
                        style={{
                          color: printTheme.brand,
                          marginTop: 4,
                          wordBreak: "break-all",
                        }}
                      >
                        {href}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <PrintPageFooter generatedAt={generatedAt} />
        </PrintPage>
      ) : null}

      {/* ── Qué lograrás ── */}
      <PrintPage
        style={{ minHeight: 1050, display: "flex", flexDirection: "column" }}
      >
        <PrintPageHeader siteLabel={label} />
        <PrintSectionTitle subtitle="Este es el objetivo final: no solo corregir errores técnicos, sino lograr resultados visibles para tu negocio.">
          Qué lograrás al implementar estas mejoras
        </PrintSectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {expectedOutcomes.map((outcome, index) => (
            <div
              key={`${outcome.area}-${index}`}
              style={{
                border: `1px solid ${printTheme.border}`,
                borderRadius: 14,
                padding: 16,
                borderTop: `4px solid ${printTheme.brand}`,
                breakInside: "avoid",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: printTheme.brand,
                  marginBottom: 6,
                }}
              >
                {outcome.area}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: printTheme.muted,
                  marginBottom: 10,
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: printTheme.textSoft }}>
                  Recomendación:{" "}
                </strong>
                {outcome.recommendation}
              </div>
              <div
                style={{
                  borderRadius: 8,
                  background: printTheme.greenSoft,
                  border: `1px solid #a7f3d0`,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: printTheme.green,
                    marginBottom: 4,
                  }}
                >
                  Resultado esperado
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: printTheme.textSoft,
                  }}
                >
                  {outcome.expectedResult}
                </p>
              </div>
            </div>
          ))}
        </div>

        <PrintSectionTitle subtitle="Orden sugerido para ver resultados sin abrumar al equipo.">
          Hoja de ruta
        </PrintSectionTitle>
        <div style={{ display: "grid", gap: 10 }}>
          {roadmapPhases.map((phase) => (
            <div
              key={phase.phase}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 1.4fr",
                gap: 12,
                alignItems: "start",
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 14,
                background: printTheme.surface,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {phase.phase}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: printTheme.muted,
                    marginTop: 2,
                  }}
                >
                  {phase.timeline}
                </div>
              </div>
              <div style={{ fontSize: 11, color: printTheme.textSoft }}>
                {phase.focus}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: printTheme.green,
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                → {phase.result}
              </div>
            </div>
          ))}
        </div>

        <PrintPageFooter generatedAt={generatedAt} />
      </PrintPage>

      {/* ── Cierre profesional ── */}
      <PrintPage
        style={{
          minHeight: 1050,
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        <div style={{ padding: "32px 48px 24px", flex: 1 }}>
          <PrintPageHeader siteLabel={label} />
          <PrintSectionTitle subtitle="La meta de este reporte no es asustar con números — es mostrarte el camino hacia un sitio que trabaje para tu negocio.">
            Conclusión
          </PrintSectionTitle>

          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${printTheme.brandBorder}`,
              background: printTheme.brandSoft,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.65,
                color: printTheme.textSoft,
              }}
            >
              {transformationClosing}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                textAlign: "center",
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: printTheme.muted,
                  marginBottom: 6,
                }}
              >
                HOY
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: scoreColor(audit.overall_score),
                }}
              >
                {audit.overall_score ?? "—"}
              </div>
              <div
                style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
              >
                Puntuación general
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: printTheme.muted,
                  marginBottom: 6,
                }}
              >
                A CORREGIR
              </div>
              <div
                style={{ fontSize: 28, fontWeight: 800, color: printTheme.red }}
              >
                {severityCounts.critico + severityCounts.importante}
              </div>
              <div
                style={{ fontSize: 10, color: printTheme.muted, marginTop: 4 }}
              >
                Críticos + importantes
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                border: `1px solid ${printTheme.border}`,
                borderRadius: 12,
                padding: 16,
                borderTop: `4px solid ${printTheme.green}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: printTheme.muted,
                  marginBottom: 6,
                }}
              >
                OBJETIVO
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: printTheme.green,
                  lineHeight: 1.35,
                }}
              >
                Sitio rápido, confiable y visible en Google
              </div>
              <div
                style={{ fontSize: 10, color: printTheme.muted, marginTop: 6 }}
              >
                Más visitas que convierten
              </div>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${printTheme.border}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              Próximos pasos
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 11,
                lineHeight: 1.6,
                color: printTheme.textSoft,
              }}
            >
              <li>
                Revisar los hallazgos críticos con tu equipo web o agencia.
              </li>
              <li>
                Implementar el plan de acción prioritario (Fase 1 primero).
              </li>
              <li>
                Programar un nuevo análisis en 30–60 días para medir avance.
              </li>
            </ol>
          </div>
        </div>

        <div
          style={{
            background: `linear-gradient(135deg, ${printTheme.brand} 0%, ${printTheme.brandMid} 100%)`,
            padding: "28px 48px",
            color: printTheme.white,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: printTheme.white,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
            }}
          >
            <PrintAgencyLogo width={180} style={{ margin: "0 auto" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {PRINT_AGENCY_NAME}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.95,
              marginTop: 2,
            }}
          >
            {PRINT_REPORT_LABEL} · Reporte de salud web
          </div>
          <p
            style={{
              margin: "8px auto 0",
              fontSize: 11,
              opacity: 0.9,
              maxWidth: 420,
              lineHeight: 1.5,
            }}
          >
            Preparado el {generatedAt}
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 10, opacity: 0.75 }}>
            {label} · {audit.audit_url}
          </p>
        </div>
      </PrintPage>
    </div>
  );
};
