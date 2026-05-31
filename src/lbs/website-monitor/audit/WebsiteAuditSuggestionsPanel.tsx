import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AuditFinding, WebsiteAudit, WebsiteAuditAiSummaryJson } from "@/lbs/website-monitor/audit/types";
import { getAuditSnapshots, snapshotScores } from "@/lbs/website-monitor/audit/auditUtils";
import { parseFindingDescription } from "@/lbs/website-monitor/audit/findingDetailUtils";
import { WebsiteAuditFindingDetailSections } from "@/lbs/website-monitor/audit/WebsiteAuditFindingDetailSections";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { buildFindingInsightMap } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import { cn } from "@/lib/utils";

const IMPACT_LABELS: Record<string, { label: string; className: string }> = {
  critico: { label: "Alto", className: "bg-red-100 text-red-700" },
  importante: { label: "Medio", className: "bg-amber-100 text-amber-800" },
  "nice-to-have": { label: "Bajo", className: "bg-slate-100 text-slate-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance",
  seo: "SEO",
  a11y: "Accesibilidad",
  static: "Contenido",
  best_practices: "Best practices",
};

const CATEGORY_WHY: Record<string, string> = {
  performance:
    "Sitios lentos pierden visitas; Google usa Core Web Vitals en ranking.",
  seo: "SEO técnico incorrecto limita indexación y snippets en buscadores.",
  a11y: "Accesibilidad mejora UX y reduce riesgo legal.",
  static: "Errores directos en HTML: enlaces, imágenes, meta tags.",
  best_practices: "HTTPS y buenas prácticas generan confianza en el navegador.",
};

const SEVERITY_ORDER = ["critico", "importante", "nice-to-have"] as const;

export const WebsiteAuditSuggestionsPanel = ({
  audit,
  findings,
  aiSummary,
}: {
  audit: WebsiteAudit;
  findings: AuditFinding[];
  aiSummary?: WebsiteAuditAiSummaryJson | null;
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { mobile } = getAuditSnapshots(audit);
  const mobileScores = snapshotScores(mobile);

  const suggestions = useMemo(
    () =>
      [...findings]
        .filter((f) => f.recommendation?.trim())
        .sort((a, b) => {
          const sa = SEVERITY_ORDER.indexOf(
            a.severity as (typeof SEVERITY_ORDER)[number],
          );
          const sb = SEVERITY_ORDER.indexOf(
            b.severity as (typeof SEVERITY_ORDER)[number],
          );
          if (sa !== sb) return sa - sb;
          return a.display_order - b.display_order;
        }),
    [findings],
  );

  const findingInsights = useMemo(
    () => buildFindingInsightMap(findings, aiSummary),
    [findings, aiSummary],
  );

  const toggleRow = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin sugerencias con pasos concretos. Regenera el reporte con el worker
        actualizado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Plan de acción</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada fila es un hallazgo concreto con ubicación y pasos para corregirlo.
        </p>
        {mobileScores.performance != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Scores móvil — Performance {mobileScores.performance}/100 · SEO{" "}
            {mobileScores.seo ?? "—"}/100 · A11y{" "}
            {mobileScores.accessibility ?? "—"}/100
          </p>
        ) : null}
      </div>

      <WebsiteAuditTableShell
        columns={["", "#", "Impacto", "Hallazgo", "Dónde"]}
      >
        {suggestions.map((finding, index) => {
          const impact = IMPACT_LABELS[finding.severity] ?? IMPACT_LABELS.importante;
          const isOpen = expanded.has(finding.id);
          const aiInsight = findingInsights.get(finding.id);
          const parsed = parseFindingDescription(finding.description);
          const why = CATEGORY_WHY[finding.category];

          return (
            <Fragment key={finding.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => toggleRow(finding.id)}
              >
                <TableCell className="w-8 px-2">
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="w-10 text-center text-sm font-bold text-primary">
                  {index + 1}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      impact.className,
                    )}
                  >
                    {impact.label}
                  </span>
                </TableCell>
                <TableCell className="max-w-[320px] whitespace-normal">
                  <p className="text-sm font-medium leading-snug">{finding.title}</p>
                  {finding.recommendation ? (
                    <p className="mt-1 line-clamp-2 text-xs text-emerald-800/90">
                      {finding.recommendation}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[200px] whitespace-normal font-mono text-[10px] text-muted-foreground">
                  {parsed.locationPreview ? (
                    <span className="line-clamp-2 break-all">
                      {parsed.locationPreview}
                    </span>
                  ) : (
                    CATEGORY_LABELS[finding.category] ?? finding.category
                  )}
                </TableCell>
              </TableRow>
              {isOpen ? (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={5} className="whitespace-normal p-4">
                    <WebsiteAuditFindingDetailSections
                      finding={finding}
                      aiInsight={aiInsight}
                      showCategoryWhy
                      categoryWhy={why}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </WebsiteAuditTableShell>
    </div>
  );
};
