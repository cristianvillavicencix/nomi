import { Loader2, Monitor, Smartphone, Sparkles } from "lucide-react";
import type {
  AuditFinding,
  StaticAnalysisJson,
  WebsiteAudit,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { snapshotScores } from "@/lbs/website-monitor/audit/auditUtils";
import { ScoreGauge } from "@/lbs/website-monitor/audit/ScoreGauge";
import { MetricInfo } from "@/lbs/website-monitor/audit/MetricInfo";
import { WebsiteAuditAiTextBlock } from "@/lbs/website-monitor/audit/WebsiteAuditAiTextBlock";
import {
  countFindingsBySeverity,
  getHealthHeadline,
  getMetricsNarrative,
  getResumenOverview,
} from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import { cn } from "@/lib/utils";

type SnapshotScores = ReturnType<typeof snapshotScores>;

const CATEGORY_ROWS = [
  {
    id: "performance",
    label: "Performance",
    narrativeKey: "performance" as const,
  },
  { id: "seo", label: "SEO", narrativeKey: "seo" as const },
  {
    id: "accessibility",
    label: "Accesibilidad",
    narrativeKey: "accessibility" as const,
  },
  {
    id: "best-practices",
    label: "Best practices",
    narrativeKey: "best_practices" as const,
  },
] as const;

const scoreDelta = (current?: number | null, previous?: number | null) => {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return "sin cambio";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const SeverityStatCard = ({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "red" | "amber" | "emerald";
}) => {
  const toneClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-4xl font-bold tabular-nums", toneClass)}>
        {count}
      </p>
    </div>
  );
};

const DeviceScoreColumn = ({
  label,
  icon: Icon,
  snapshot,
  previousSnapshot,
  onCategoryClick,
}: {
  label: string;
  icon: typeof Smartphone;
  snapshot: SnapshotScores;
  previousSnapshot?: SnapshotScores | null;
  onCategoryClick?: (category: string) => void;
}) => {
  const delta = scoreDelta(snapshot.overall, previousSnapshot?.overall);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
        {delta ? (
          <span className="text-xs text-muted-foreground">
            vs anterior: {delta}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreGauge
          label="Global"
          value={snapshot.overall}
          tooltipKey="overall"
        />
        <ScoreGauge
          label="Performance"
          value={snapshot.performance}
          tooltipKey="performance"
          onClick={
            onCategoryClick ? () => onCategoryClick("performance") : undefined
          }
        />
        <ScoreGauge
          label="SEO"
          value={snapshot.seo}
          tooltipKey="seo"
          onClick={onCategoryClick ? () => onCategoryClick("seo") : undefined}
        />
        <ScoreGauge
          label="Best practices"
          value={snapshot.bestPractices}
          tooltipKey="bestPractices"
          onClick={
            onCategoryClick
              ? () => onCategoryClick("best-practices")
              : undefined
          }
        />
      </div>
    </div>
  );
};

const AiStatusBanner = ({ audit }: { audit: WebsiteAudit }) => {
  const status = audit.ai_summary_status;

  if (status === "done") return null;

  if (status === "pending" || status === "running") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-violet-200/70 bg-violet-50/60 px-3 py-2 text-sm text-violet-900 dark:border-violet-500/20 dark:bg-violet-950/20 dark:text-violet-100">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        Generando interpretación con IA…
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-100">
        No se pudo generar la interpretación IA. Los números siguen siendo
        válidos; revisa la pestaña «Resumen IA» para reintentar.
      </div>
    );
  }

  return null;
};

export const WebsiteAuditResumenPanel = ({
  audit,
  aiSummary,
  findings,
  mobileScores,
  desktopScores,
  previousMobileScores,
  previousDesktopScores,
  hasScores,
  onCategoryClick,
  staticJson,
  cruxLabel,
}: {
  audit: WebsiteAudit;
  aiSummary?: WebsiteAuditAiSummaryJson | null;
  findings: AuditFinding[];
  mobileScores: SnapshotScores;
  desktopScores: SnapshotScores;
  previousMobileScores?: SnapshotScores | null;
  previousDesktopScores?: SnapshotScores | null;
  hasScores: boolean;
  onCategoryClick?: (category: string) => void;
  staticJson: StaticAnalysisJson;
  cruxLabel: string | null;
}) => {
  const severityCounts = countFindingsBySeverity(findings);
  const metricsNarrative = getMetricsNarrative(aiSummary);
  const headline = getHealthHeadline(aiSummary);
  const overview = getResumenOverview(aiSummary);
  const scoresIntro =
    metricsNarrative?.scores?.overall?.trim() ||
    "Estas son las cuatro áreas que mide Google, comparadas entre la versión de celular y la de computadora. El número combinado pesa 70% móvil y 30% desktop.";

  return (
    <div className="space-y-6">
      <AiStatusBanner audit={audit} />

      {hasScores ? (
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center sm:justify-start">
              <ScoreGauge
                label=""
                value={audit.overall_score}
                size="xl"
                tooltipKey="combined"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {headline ?? "Resumen del sitio"}
              </h3>
              {overview ? (
                <WebsiteAuditAiTextBlock title="Interpretación IA">
                  <p>{overview}</p>
                </WebsiteAuditAiTextBlock>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {audit.ai_summary_status === "pending" ||
                  audit.ai_summary_status === "running"
                    ? "La interpretación en lenguaje claro aparecerá aquí en cuanto termine el análisis con IA."
                    : "Revisa las pestañas de métricas y hallazgos para ver el detalle de cada área."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SeverityStatCard
          label="Problemas críticos"
          count={severityCounts.critico}
          tone="red"
        />
        <SeverityStatCard
          label="Mejoras importantes"
          count={severityCounts.importante}
          tone="amber"
        />
        <SeverityStatCard
          label="Detalles menores"
          count={severityCounts["nice-to-have"]}
          tone="emerald"
        />
      </div>

      {hasScores ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                Puntuación por categoría
              </h3>
              <MetricInfo tooltipKey="combined" />
            </div>
            {metricsNarrative?.scores?.overall?.trim() ? (
              <WebsiteAuditAiTextBlock
                title="Interpretación IA"
                className="max-w-3xl"
              >
                <p>{scoresIntro}</p>
              </WebsiteAuditAiTextBlock>
            ) : (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {scoresIntro}
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DeviceScoreColumn
              label="Móvil"
              icon={Smartphone}
              snapshot={mobileScores}
              previousSnapshot={previousMobileScores}
              onCategoryClick={onCategoryClick}
            />
            <DeviceScoreColumn
              label="Desktop"
              icon={Monitor}
              snapshot={desktopScores}
              previousSnapshot={previousDesktopScores}
              onCategoryClick={onCategoryClick}
            />
          </div>

          {metricsNarrative?.scores ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORY_ROWS.map(({ id, label, narrativeKey }) => {
                const text = metricsNarrative.scores?.[narrativeKey]?.trim();
                if (!text) return null;
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Sparkles className="size-3.5 text-violet-600" />
                      {label}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {onCategoryClick ? (
            <p className="text-center text-[10px] text-muted-foreground">
              Toca Performance, SEO o Best practices para ver el desglose
            </p>
          ) : null}
        </div>
      ) : null}

      {(staticJson.title || staticJson.metaDescription) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Título
            </p>
            <p className="mt-1 font-medium">{staticJson.title ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Meta descripción
            </p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">
              {staticJson.metaDescription ?? "—"}
            </p>
          </div>
        </div>
      )}

      {audit.crux_has_data ? (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {cruxLabel}:
          {audit.field_lcp_ms != null
            ? ` LCP ${Math.round(Number(audit.field_lcp_ms))} ms`
            : ""}
          {audit.field_cls != null
            ? ` · CLS ${Number(audit.field_cls).toFixed(3)}`
            : ""}
          {audit.field_inp_ms != null
            ? ` · INP ${Math.round(Number(audit.field_inp_ms))} ms`
            : ""}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin datos CrUX de campo (tráfico insuficiente en Chrome).
        </p>
      )}
    </div>
  );
};
