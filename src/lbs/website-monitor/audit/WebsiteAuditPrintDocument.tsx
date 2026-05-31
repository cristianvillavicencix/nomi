import type { ReactNode } from "react";
import type { AuditFinding, StaticAnalysisJson, WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import {
  getAuditSnapshots,
  snapshotScores,
} from "@/lbs/website-monitor/audit/auditUtils";
import { buildAuditComparison } from "@/lbs/website-monitor/audit/auditComparison";
import { formatLabMetric } from "@/lbs/website-monitor/audit/labMetricUtils";
import { WEB_AUDIT_PDF_ROOT_ID } from "@/lbs/website-monitor/audit/websiteAuditPdfExport";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";
import {
  getSocialLinkLabel,
  normalizeSocialUrl,
} from "@/lbs/clients/clientSocialLinks";

const scoreColor = (value?: number | null) => {
  if (value == null) return "#64748b";
  if (value >= 90) return "#059669";
  if (value >= 50) return "#d97706";
  return "#dc2626";
};

const PrintScore = ({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) => (
  <div style={{ textAlign: "center", padding: "4px 8px" }}>
    <div
      style={{
        width: 56,
        height: 56,
        margin: "0 auto 6px",
        borderRadius: "50%",
        border: `4px solid ${value != null ? scoreColor(value) : "#cbd5e1"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 16,
        color: scoreColor(value),
      }}
    >
      {value != null ? value : "—"}
    </div>
    <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
  </div>
);

const PrintLabMetric = ({
  label,
  metric,
  value,
}: {
  label: string;
  metric: "fcp" | "lcp" | "cls" | "tbt";
  value?: number | null;
}) => (
  <div
    style={{
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: 12,
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#64748b",
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
      {formatLabMetric(metric, value)}
    </div>
  </div>
);

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2
    style={{
      fontSize: 14,
      fontWeight: 700,
      color: "#0f172a",
      margin: "24px 0 12px",
      paddingBottom: 6,
      borderBottom: "2px solid #e2e8f0",
    }}
  >
    {children}
  </h2>
);

const SEVERITY_ORDER = ["critico", "importante", "nice-to-have"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  critico: "Críticos",
  importante: "Importantes",
  "nice-to-have": "Menores",
};
const SEVERITY_COLORS: Record<string, string> = {
  critico: "#dc2626",
  importante: "#d97706",
  "nice-to-have": "#64748b",
};

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

  const sortedFindings = [...findings].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity as (typeof SEVERITY_ORDER)[number]);
    const sb = SEVERITY_ORDER.indexOf(b.severity as (typeof SEVERITY_ORDER)[number]);
    if (sa !== sb) return sa - sb;
    return a.display_order - b.display_order;
  });

  return (
    <div
      id={WEB_AUDIT_PDF_ROOT_ID}
      className="web-audit-pdf-document"
      style={{
        width: 794,
        maxWidth: 794,
        margin: "0 auto",
        padding: "32px 40px",
        background: "#fff",
        color: "#0f172a",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6366f1",
            marginBottom: 4,
          }}
        >
          Web Report · Nomi
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{label}</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>{audit.audit_url}</p>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 11 }}>
          Generado: {formatCheckedAt(audit.completed_at ?? audit.requested_at)} ·
          Estrategia: móvil + desktop
        </p>
      </header>

      {audit.overall_score != null ? (
        <div
          style={{
            textAlign: "center",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #c7d2fe",
            background: "#eef2ff",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
            Score combinado (70% móvil · 30% desktop)
          </div>
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto",
              borderRadius: "50%",
              border: `6px solid ${scoreColor(audit.overall_score)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 32,
              color: scoreColor(audit.overall_score),
            }}
          >
            {audit.overall_score}
          </div>
        </div>
      ) : null}

      {comparison.hasPrevious ? (
        <>
          <SectionTitle>Evolución vs reporte anterior</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {comparison.metrics.map((metric) => (
              <div
                key={metric.key}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 8,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 10, color: "#64748b" }}>{metric.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{metric.current ?? "—"}</div>
                {metric.delta != null ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: metric.delta >= 0 ? "#059669" : "#dc2626",
                    }}
                  >
                    {metric.delta >= 0 ? `+${metric.delta}` : metric.delta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {comparison.newFindings.length > 0 ? (
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
              {comparison.newFindings.length} hallazgo(s) nuevo(s) ·{" "}
              {comparison.resolvedFindings.length} resuelto(s)
            </p>
          ) : null}
        </>
      ) : null}

      <SectionTitle>Resumen — Móvil</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <PrintScore label="Global" value={mobileScores.overall} />
        <PrintScore label="Performance" value={mobileScores.performance} />
        <PrintScore label="SEO" value={mobileScores.seo} />
        <PrintScore label="Best practices" value={mobileScores.bestPractices} />
      </div>

      <SectionTitle>Resumen — Desktop</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <PrintScore label="Global" value={desktopScores.overall} />
        <PrintScore label="Performance" value={desktopScores.performance} />
        <PrintScore label="SEO" value={desktopScores.seo} />
        <PrintScore label="Best practices" value={desktopScores.bestPractices} />
      </div>

      <SectionTitle>Core Web Vitals — Móvil</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        <PrintLabMetric label="FCP" metric="fcp" value={mobileScores.labFcpMs} />
        <PrintLabMetric label="LCP" metric="lcp" value={mobileScores.labLcpMs} />
        <PrintLabMetric label="CLS" metric="cls" value={mobileScores.labCls} />
        <PrintLabMetric label="TBT" metric="tbt" value={mobileScores.labTbtMs} />
      </div>

      <SectionTitle>Core Web Vitals — Desktop</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        <PrintLabMetric label="FCP" metric="fcp" value={desktopScores.labFcpMs} />
        <PrintLabMetric label="LCP" metric="lcp" value={desktopScores.labLcpMs} />
        <PrintLabMetric label="CLS" metric="cls" value={desktopScores.labCls} />
        <PrintLabMetric label="TBT" metric="tbt" value={desktopScores.labTbtMs} />
      </div>

      {audit.crux_has_data ? (
        <p style={{ marginTop: 12, fontSize: 11, color: "#64748b" }}>
          Datos de campo (CrUX):
          {audit.field_lcp_ms != null
            ? ` LCP ${Math.round(Number(audit.field_lcp_ms))} ms`
            : ""}
          {audit.field_cls != null
            ? ` · CLS ${Number(audit.field_cls).toFixed(3)}`
            : ""}
          {audit.field_inp_ms != null
            ? ` · INP ${Math.round(Number(audit.field_inp_ms))} ms`
            : ""}
        </p>
      ) : null}

      <SectionTitle>Contenido</SectionTitle>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            TÍTULO
          </div>
          <div>{staticJson.title ?? "—"}</div>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
            META DESCRIPCIÓN
          </div>
          <div style={{ color: "#475569" }}>{staticJson.metaDescription ?? "—"}</div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
              H1
            </div>
            <div>{staticJson.h1Text ?? "—"}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
              {staticJson.h1Count ?? 0} H1 en la página
            </div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
              IMÁGENES
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {staticJson.totalImages ?? 0}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>
                {" "}
                total · {staticJson.imagesOk ?? 0} OK ·{" "}
                {staticJson.imagesWithoutAlt ?? 0} sin alt ·{" "}
                {staticJson.brokenImages ?? 0} rotas
              </span>
            </div>
          </div>
        </div>
      </div>

      {staticJson.crawlFiles ? (
        <>
          <SectionTitle>Archivos críticos de rastreo</SectionTitle>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Archivo</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["robots.txt", staticJson.crawlFiles.robots],
                ["sitemap", staticJson.crawlFiles.sitemap],
                ["llms.txt", staticJson.crawlFiles.llmsTxt],
                ["security.txt", staticJson.crawlFiles.securityTxt],
              ]
                .filter((row) => row[1])
                .map(([name, file]) => {
                  const snap = file as { found?: boolean; access?: string };
                  const status = snap.found
                    ? "Encontrado"
                    : snap.access === "blocked"
                      ? "Bloqueado WAF"
                      : "No encontrado";
                  return (
                    <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px" }}>{name}</td>
                      <td style={{ padding: "6px 8px" }}>{status}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {staticJson.crawlFiles.aiSeoChecklist?.score != null ? (
            <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
              AI SEO Checklist: {staticJson.crawlFiles.aiSeoChecklist.score}/100 (
              {staticJson.crawlFiles.aiSeoChecklist.passed}/
              {staticJson.crawlFiles.aiSeoChecklist.total} checks)
            </p>
          ) : null}
        </>
      ) : null}

      <SectionTitle>
        Enlaces ({staticJson.totalPageLinks ?? staticJson.pageLinks?.length ?? 0})
      </SectionTitle>
      {(staticJson.pageLinks?.length ?? 0) === 0 ? (
        <p style={{ color: "#64748b", fontSize: 12 }}>
          No hay datos de enlaces en este reporte. Regenera con el worker actualizado.
        </p>
      ) : (
        <>
          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
            {staticJson.brokenLinkCount ?? 0} rotos ·{" "}
            {staticJson.checkedLinkCount ?? staticJson.pageLinks?.length ?? 0} verificados
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {(staticJson.pageLinks ?? [])
              .filter((link) => !link.ok)
              .slice(0, 25)
              .map((link) => (
                <li
                  key={link.url}
                  style={{
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 8,
                    fontSize: 12,
                  }}
                >
                  <strong style={{ color: "#b91c1c" }}>
                    {link.status != null ? `HTTP ${link.status}` : "Error"}
                  </strong>
                  {link.text ? <div>{link.text}</div> : null}
                  <div style={{ color: "#6366f1", marginTop: 4, wordBreak: "break-all" }}>
                    {link.url}
                  </div>
                </li>
              ))}
          </ul>
        </>
      )}

      <SectionTitle>
        Redes sociales ({staticJson.socialLinks?.length ?? 0})
      </SectionTitle>
      {(staticJson.socialLinks?.length ?? 0) === 0 ? (
        <p style={{ color: "#64748b", fontSize: 12 }}>
          No se encontraron enlaces a redes sociales en el HTML analizado.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {(staticJson.socialLinks ?? []).map((link) => {
            const href = normalizeSocialUrl(link.url);
            const label = getSocialLinkLabel(link);
            return (
              <li
                key={`${link.network}-${href}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <strong>{label}</strong>
                <div style={{ color: "#6366f1", marginTop: 4, wordBreak: "break-all" }}>
                  {href}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle>Hallazgos ({sortedFindings.length})</SectionTitle>
      {sortedFindings.length === 0 ? (
        <p style={{ color: "#64748b" }}>Sin hallazgos registrados.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sortedFindings.map((finding) => (
            <li
              key={finding.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 8,
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: SEVERITY_COLORS[finding.severity] ?? "#64748b",
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}
                >
                  {SEVERITY_LABELS[finding.severity] ?? finding.severity}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "2px 6px",
                    textTransform: "uppercase",
                  }}
                >
                  {finding.category}
                </span>
                <strong style={{ fontSize: 12 }}>{finding.title}</strong>
              </div>
              {finding.description ? (
                <p style={{ margin: "6px 0 0", color: "#475569" }}>{finding.description}</p>
              ) : null}
              {finding.recommendation ? (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
                  {finding.recommendation}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          marginTop: 28,
          paddingTop: 12,
          borderTop: "1px solid #e2e8f0",
          fontSize: 10,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        Reporte generado por Nomi CRM · {formatCheckedAt(new Date().toISOString())}
      </footer>
    </div>
  );
};
