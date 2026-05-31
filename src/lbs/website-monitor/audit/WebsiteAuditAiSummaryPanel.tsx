import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dataProvider } from "@/components/atomic-crm/providers/supabase/dataProvider";
import type {
  WebsiteAudit,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { cn } from "@/lib/utils";

const HEALTH_LABELS: Record<
  NonNullable<WebsiteAuditAiSummaryJson["overall_health"]>,
  { label: string; className: string }
> = {
  good: { label: "Buen estado", className: "bg-emerald-100 text-emerald-800" },
  needs_work: {
    label: "Requiere mejoras",
    className: "bg-amber-100 text-amber-800",
  },
  critical: { label: "Crítico", className: "bg-red-100 text-red-700" },
};

const IMPACT_LABELS: Record<string, { label: string; className: string }> = {
  high: { label: "Alto", className: "bg-red-100 text-red-700" },
  medium: { label: "Medio", className: "bg-amber-100 text-amber-800" },
  low: { label: "Bajo", className: "bg-slate-100 text-slate-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance",
  seo: "SEO",
  a11y: "Accesibilidad",
  static: "Contenido",
  best_practices: "Best practices",
};

const SummaryContent = ({ summary }: { summary: WebsiteAuditAiSummaryJson }) => {
  const health = HEALTH_LABELS[summary.overall_health];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("text-xs font-semibold", health.className)}>
          {health.label}
        </Badge>
        {summary.priority_actions.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {summary.priority_actions.length} acciones prioritarias
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resumen ejecutivo
        </p>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          {summary.executive_summary.split(/\n\n+/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      {(summary.highlights.strengths.length > 0 ||
        summary.highlights.risks.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {summary.highlights.strengths.length > 0 ? (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-emerald-800">
                Fortalezas
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-emerald-950/80">
                {summary.highlights.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {summary.highlights.risks.length > 0 ? (
            <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-red-800">
                Riesgos
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-red-950/80">
                {summary.highlights.risks.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {summary.priority_actions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plan de acción
          </p>
          <WebsiteAuditTableShell
            columns={["#", "Acción", "Impacto", "Categoría"]}
          >
            {summary.priority_actions.map((action) => {
              const impact = IMPACT_LABELS[action.impact] ?? IMPACT_LABELS.medium;
              return (
                <TableRow key={action.rank}>
                  <TableCell className="w-10 font-mono text-xs text-muted-foreground">
                    {action.rank}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.why}</p>
                    <p className="mt-2 text-xs">
                      <span className="font-medium text-foreground/80">Cómo: </span>
                      {action.how}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", impact.className)}>
                      {impact.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {action.category
                      ? (CATEGORY_LABELS[action.category] ?? action.category)
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </WebsiteAuditTableShell>
        </div>
      ) : null}

      {summary.technical_notes?.trim() ? (
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/70">Nota técnica: </span>
          {summary.technical_notes}
        </div>
      ) : null}
    </div>
  );
};

export const WebsiteAuditAiSummaryPanel = ({
  audit,
}: {
  audit: WebsiteAudit;
}) => {
  const queryClient = useQueryClient();
  const status = audit.ai_summary_status;
  const summary = audit.ai_summary_json ?? null;

  const regenerate = useMutation({
    mutationFn: () =>
      dataProvider.websiteAuditSummarize({
        auditId: audit.id,
        force: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["website-audit-detail", String(audit.id)],
      });
    },
  });

  const isBusy =
    status === "pending" ||
    status === "running" ||
    regenerate.isPending;

  if (status === "done" && summary) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {audit.ai_summary_generated_at
              ? `Generado ${new Date(audit.ai_summary_generated_at).toLocaleString("es")}`
              : "Análisis generado con IA"}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => regenerate.mutate()}
          >
            {regenerate.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Regenerar
          </Button>
        </div>
        <SummaryContent summary={summary} />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-4 rounded-xl border border-red-200/60 bg-red-50/40 p-5">
        <p className="text-sm font-medium text-red-800">
          No se pudo generar el resumen con IA.
        </p>
        {audit.ai_summary_error ? (
          <p className="text-xs text-red-700/80">{audit.ai_summary_error}</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={() => regenerate.mutate()}
        >
          {regenerate.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Reintentar
        </Button>
      </div>
    );
  }

  if (status === "skipped") {
    return (
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
        <p>El análisis con IA no está disponible en este entorno.</p>
        {audit.ai_summary_error ? (
          <p className="text-xs">{audit.ai_summary_error}</p>
        ) : null}
      </div>
    );
  }

  if (isBusy || status === "pending" || status === "running") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-6 py-12 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Generando resumen con IA…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Claude analiza scores, hallazgos y contenido del sitio. Suele tardar
            menos de un minuto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
      <Sparkles className="size-8 text-primary/70" />
      <div>
        <p className="text-sm font-medium">Resumen IA no generado</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Genera un análisis ejecutivo en español basado en los datos reales de
          este reporte.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={regenerate.isPending}
        onClick={() => regenerate.mutate()}
      >
        {regenerate.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        Generar análisis IA
      </Button>
    </div>
  );
};
