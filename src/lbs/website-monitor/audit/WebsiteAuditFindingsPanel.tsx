import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditFinding, WebsiteAuditAiSummaryJson } from "@/lbs/website-monitor/audit/types";
import {
  buildFindingFilterOptions,
  categoryFromFindingFilter,
  filterFindings,
  findingFilterFromCategory,
  parseFindingDescription,
  type FindingFilterValue,
} from "@/lbs/website-monitor/audit/findingDetailUtils";
import { WebsiteAuditFindingDetailSections } from "@/lbs/website-monitor/audit/WebsiteAuditFindingDetailSections";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { buildFindingInsightMap } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import { cn } from "@/lib/utils";

const SEVERITY_LABELS: Record<string, string> = {
  critico: "CRÍTICO",
  importante: "IMPORTANTE",
  "nice-to-have": "MENOR",
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance",
  seo: "SEO",
  a11y: "Accesibilidad",
  static: "Contenido",
  best_practices: "Best practices",
  security: "Seguridad",
};

const METRICS_LINK: Record<string, string> = {
  performance: "performance",
  seo: "seo",
  a11y: "accessibility",
  best_practices: "best-practices",
};

const SEVERITY_ROW: Record<string, string> = {
  critico: "border-l-4 border-l-red-500",
  importante: "border-l-4 border-l-amber-500",
  "nice-to-have": "border-l-4 border-l-slate-300",
};

export const WebsiteAuditFindingsPanel = ({
  findings,
  categoryFilter: controlledCategory,
  onCategoryFilterChange,
  onOpenMetrics,
  aiSummary,
}: {
  findings: AuditFinding[];
  categoryFilter?: string | null;
  onCategoryFilterChange?: (category: string | null) => void;
  onOpenMetrics?: (lighthouseCategoryId: string) => void;
  aiSummary?: WebsiteAuditAiSummaryJson | null;
}) => {
  const [filter, setFilter] = useState<FindingFilterValue>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (controlledCategory != null) {
      setFilter(findingFilterFromCategory(controlledCategory));
    }
  }, [controlledCategory]);

  const handleFilterChange = (value: FindingFilterValue) => {
    setFilter(value);
    onCategoryFilterChange?.(categoryFromFindingFilter(value));
  };

  const toggleRow = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const findingInsights = useMemo(
    () => buildFindingInsightMap(findings, aiSummary),
    [findings, aiSummary],
  );

  const filterOptions = useMemo(
    () => buildFindingFilterOptions(findings),
    [findings],
  );

  const visible = useMemo(
    () => filterFindings(findings, filter),
    [filter, findings],
  );

  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin hallazgos registrados para este reporte.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Hallazgos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Qué falló, dónde ocurre y cómo corregirlo. Expande cada fila para el
            detalle completo.
          </p>
        </div>
        <Select
          value={filter}
          onValueChange={(value) => handleFilterChange(value as FindingFilterValue)}
        >
          <SelectTrigger className="h-9 w-[200px] print:hidden" size="sm">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <WebsiteAuditTableShell
        columns={["", "Urgencia", "Área", "Hallazgo", "Ubicación"]}
      >
        {visible.map((finding) => {
          const isOpen = expanded.has(finding.id);
          const aiInsight = findingInsights.get(finding.id);
          const parsed = parseFindingDescription(finding.description);
          const locationPreview =
            parsed.locationPreview ??
            (finding.source_id ? `Regla ${finding.source_id}` : null);

          return (
            <Fragment key={finding.id}>
              <TableRow
                className={cn("cursor-pointer", SEVERITY_ROW[finding.severity])}
                onClick={() => toggleRow(finding.id)}
              >
                <TableCell className="w-8 px-2">
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge
                    variant={
                      finding.severity === "critico" ? "destructive" : "secondary"
                    }
                    className="text-[10px] font-bold"
                  >
                    {SEVERITY_LABELS[finding.severity] ?? finding.severity}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {CATEGORY_LABELS[finding.category] ?? finding.category}
                </TableCell>
                <TableCell className="max-w-[300px] whitespace-normal">
                  <p className="text-sm font-medium leading-snug">{finding.title}</p>
                  {parsed.problem && parsed.problem !== finding.title ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {parsed.problem}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal font-mono text-[10px] text-muted-foreground">
                  {locationPreview ? (
                    <span className="line-clamp-2 break-all">{locationPreview}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
              {isOpen ? (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={5} className="whitespace-normal p-4">
                    <WebsiteAuditFindingDetailSections
                      finding={finding}
                      aiInsight={aiInsight}
                    />
                    {onOpenMetrics && METRICS_LINK[finding.category] ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-3 h-auto p-0 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMetrics(METRICS_LINK[finding.category]!);
                        }}
                      >
                        Ver desglose en Métricas →
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </WebsiteAuditTableShell>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay hallazgos con este filtro.
        </p>
      ) : null}
    </div>
  );
};
