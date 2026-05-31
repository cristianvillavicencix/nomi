import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AuditStrategySnapshot,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { snapshotScores } from "@/lbs/website-monitor/audit/auditUtils";
import {
  formatLabMetric,
  labMetricScore,
  type LabMetricKey,
} from "@/lbs/website-monitor/audit/labMetricUtils";
import {
  mergeCategoryStatsWithSnapshot,
  parseCategoryAuditIssues,
  parseExtendedLabMetrics,
  parseLabMetricDetails,
  parseLighthouseOpportunities,
} from "@/lbs/website-monitor/audit/lighthouseParseUtils";
import {
  WebsiteAuditCategoryBars,
  WebsiteAuditOpportunitiesList,
} from "@/lbs/website-monitor/audit/WebsiteAuditLighthouseDiagnostics";
import { WebsiteAuditCategoryDetailPanel } from "@/lbs/website-monitor/audit/WebsiteAuditCategoryDetailPanel";
import { WebsiteAuditAiTextBlock } from "@/lbs/website-monitor/audit/WebsiteAuditAiTextBlock";
import { getMetricsNarrative } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import { cn } from "@/lib/utils";

const METRIC_HINTS: Record<string, string> = {
  fcp: "cuándo aparece el primer texto o imagen",
  lcp: "cuándo carga el elemento más grande (ideal < 2.5 s)",
  tbt: "cuánto se “congela” la página al cargar",
  cls: "cuánto salta el contenido al cargar",
  si: "qué tan rápido se ve el contenido completo",
  tti: "cuándo el sitio responde a clics",
};

const CATEGORY_TABS = [
  { id: "performance", label: "Performance" },
  { id: "seo", label: "SEO" },
  { id: "accessibility", label: "Accesibilidad" },
  { id: "best-practices", label: "Best practices" },
] as const;

const scoreBorderColor = (score: number | null) => {
  if (score == null) return "border-t-slate-300";
  if (score >= 90) return "border-t-emerald-500";
  if (score >= 50) return "border-t-amber-500";
  return "border-t-red-500";
};

const scoreDotColor = (score: number | null) => {
  if (score == null) return "bg-slate-400";
  if (score >= 90) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
};

const ratingBadge = (rating: string) => {
  if (rating === "good") return "bg-emerald-100 text-emerald-700";
  if (rating === "needs-improvement") return "bg-amber-100 text-amber-800";
  if (rating === "poor") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
};

const MetricCard = ({
  label,
  metricKey,
  valueMs,
  clsValue,
  aiExplanation,
}: {
  label: string;
  metricKey: LabMetricKey | "si" | "tti";
  valueMs?: number | null;
  clsValue?: number | null;
  aiExplanation?: string | null;
}) => {
  const isCls = metricKey === "cls";
  const score = isCls
    ? labMetricScore("cls", clsValue)
    : metricKey === "si" || metricKey === "tti"
      ? labMetricScore("lcp", valueMs)
      : labMetricScore(metricKey as LabMetricKey, valueMs);

  const display = isCls
    ? formatLabMetric("cls", clsValue)
    : metricKey === "fcp" ||
        metricKey === "lcp" ||
        metricKey === "tbt" ||
        metricKey === "si" ||
        metricKey === "tti"
      ? formatLabMetric(
          metricKey === "si" || metricKey === "tti" ? "lcp" : metricKey,
          valueMs,
        )
      : "—";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 shadow-sm border-t-4",
        scoreBorderColor(score),
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", scoreDotColor(score))} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{display}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {aiExplanation?.trim() || METRIC_HINTS[metricKey] || ""}
      </p>
    </div>
  );
};

const SCORE_NARRATIVE_KEY: Record<
  string,
  "performance" | "seo" | "accessibility" | "best_practices"
> = {
  performance: "performance",
  seo: "seo",
  accessibility: "accessibility",
  "best-practices": "best_practices",
};

export const WebsiteAuditMetricsPanel = ({
  mobile,
  desktop,
  focusCategory,
  onFocusCategoryChange,
  aiSummary,
}: {
  mobile: AuditStrategySnapshot | null;
  desktop: AuditStrategySnapshot | null;
  focusCategory?: string | null;
  onFocusCategoryChange?: (categoryId: string | null) => void;
  aiSummary?: WebsiteAuditAiSummaryJson | null;
}) => {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [localCategory, setLocalCategory] = useState<string | null>(null);
  const activeCategory = focusCategory ?? localCategory;

  const setCategory = (id: string | null) => {
    setLocalCategory(id);
    onFocusCategoryChange?.(id);
  };

  const snapshot = device === "mobile" ? mobile : desktop;
  const scores = snapshotScores(snapshot);
  const lab = parseExtendedLabMetrics(snapshot?.lighthouse_json);
  const opportunities = useMemo(
    () => parseLighthouseOpportunities(snapshot?.lighthouse_json),
    [snapshot?.lighthouse_json],
  );
  const categories = useMemo(
    () => mergeCategoryStatsWithSnapshot(snapshot?.lighthouse_json, snapshot),
    [snapshot],
  );
  const labDetails = useMemo(
    () =>
      parseLabMetricDetails(snapshot?.lighthouse_json, snapshot ?? undefined),
    [snapshot],
  );

  const categoryIssues = useMemo(() => {
    if (!activeCategory) return [];
    return parseCategoryAuditIssues(snapshot?.lighthouse_json, activeCategory);
  }, [activeCategory, snapshot?.lighthouse_json]);

  const activeCatStat = categories.find((c) => c.id === activeCategory);

  const fcp = scores.labFcpMs ?? lab.fcpMs;
  const lcp = scores.labLcpMs ?? lab.lcpMs;
  const cls = scores.labCls ?? lab.cls;
  const tbt = scores.labTbtMs ?? lab.tbtMs;
  const metricsNarrative = getMetricsNarrative(aiSummary);
  const cwv = metricsNarrative?.core_web_vitals;

  const metricAiText: Partial<Record<string, string | null | undefined>> = {
    fcp: cwv?.fcp,
    lcp: cwv?.lcp,
    cls: cwv?.cls,
    tbt: cwv?.tbt,
    si: cwv?.summary,
    tti: cwv?.summary,
  };

  const activeScoreNarrative =
    activeCategory && metricsNarrative?.scores
      ? metricsNarrative.scores[SCORE_NARRATIVE_KEY[activeCategory]]
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold">Métricas de rendimiento</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Medidas de Lighthouse en laboratorio (
          {device === "mobile" ? "móvil" : "desktop"}). Cada score combina
          auditorías ponderadas — abre una categoría para ver qué reglas
          fallaron y en qué recurso.
        </p>
      </div>

      {metricsNarrative?.overview ? (
        <WebsiteAuditAiTextBlock title="Qué dicen estas métricas">
          <p>{metricsNarrative.overview}</p>
        </WebsiteAuditAiTextBlock>
      ) : null}

      {cwv?.summary ? (
        <WebsiteAuditAiTextBlock title="Velocidad percibida por el visitante">
          <p>{cwv.summary}</p>
        </WebsiteAuditAiTextBlock>
      ) : null}

      <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1">
        <Button
          type="button"
          size="sm"
          variant={device === "mobile" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDevice("mobile")}
        >
          <Smartphone className="mr-1.5 size-4" />
          Móvil
        </Button>
        <Button
          type="button"
          size="sm"
          variant={device === "desktop" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDevice("desktop")}
        >
          <Monitor className="mr-1.5 size-4" />
          Desktop
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => {
          const stat = categories.find((c) => c.id === tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setCategory(activeCategory === tab.id ? null : tab.id)
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activeCategory === tab.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {tab.label}
              {stat?.score != null ? ` · ${stat.score}` : ""}
            </button>
          );
        })}
      </div>

      {activeCategory && activeCatStat ? (
        <>
          {activeScoreNarrative ? (
            <WebsiteAuditAiTextBlock
              title={`${activeCatStat.label} en lenguaje claro`}
            >
              <p>{activeScoreNarrative}</p>
            </WebsiteAuditAiTextBlock>
          ) : null}
          <WebsiteAuditCategoryDetailPanel
            categoryId={activeCategory}
            categoryLabel={activeCatStat.label}
            score={activeCatStat.score}
            passed={activeCatStat.passed}
            total={activeCatStat.total}
            issues={categoryIssues}
          />
        </>
      ) : null}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Core Web Vitals (laboratorio)</h4>
        <p className="text-xs text-muted-foreground">
          Valor medido → score 0–100 según umbrales de Google. Fuente: auditoría{" "}
          <code className="text-[10px]">lighthouse_json</code> del dispositivo
          seleccionado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {labDetails.map((detail) => (
            <div
              key={detail.key}
              className="rounded-xl border border-border/60 bg-card p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{detail.label}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    ratingBadge(detail.rating),
                  )}
                >
                  {detail.formatted}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {(() => {
                  const key = detail.key.toLowerCase();
                  const ai =
                    key === "lcp"
                      ? cwv?.lcp
                      : key === "cls"
                        ? cwv?.cls
                        : key === "fcp"
                          ? cwv?.fcp
                          : key === "tbt"
                            ? cwv?.tbt
                            : null;
                  return ai?.trim() || detail.explanation;
                })()}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Umbrales: {detail.thresholds}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {detail.contributesTo}
                {detail.score != null
                  ? ` · Score métrica: ${detail.score}/100`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="FCP"
          metricKey="fcp"
          valueMs={fcp}
          aiExplanation={metricAiText.fcp}
        />
        <MetricCard
          label="LCP"
          metricKey="lcp"
          valueMs={lcp}
          aiExplanation={metricAiText.lcp}
        />
        <MetricCard
          label="TBT"
          metricKey="tbt"
          valueMs={tbt}
          aiExplanation={metricAiText.tbt}
        />
        <MetricCard
          label="CLS"
          metricKey="cls"
          clsValue={cls}
          aiExplanation={metricAiText.cls}
        />
        <MetricCard
          label="SI"
          metricKey="si"
          valueMs={lab.siMs}
          aiExplanation={metricAiText.si}
        />
        <MetricCard
          label="TTI"
          metricKey="tti"
          valueMs={lab.ttiMs}
          aiExplanation={metricAiText.tti}
        />
      </div>

      <WebsiteAuditOpportunitiesList opportunities={opportunities} />

      <WebsiteAuditCategoryBars categories={categories} />
    </div>
  );
};
