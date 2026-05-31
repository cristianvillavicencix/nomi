import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AuditFinding,
  StaticAnalysisJson,
  WebsiteAudit,
} from "@/lbs/website-monitor/audit/types";
import {
  auditHasLighthouseScores,
  getAuditSnapshots,
  isUnifiedReport,
  snapshotScores,
} from "@/lbs/website-monitor/audit/auditUtils";
import { ScoreGauge } from "@/lbs/website-monitor/audit/ScoreGauge";
import { WebsiteAuditReportActions } from "@/lbs/website-monitor/audit/WebsiteAuditReportActions";
import { WebsiteAuditFindingsPanel } from "@/lbs/website-monitor/audit/WebsiteAuditFindingsPanel";
import { WebsiteAuditImagesPanel } from "@/lbs/website-monitor/audit/WebsiteAuditImagesPanel";
import { WebsiteAuditLinksSocialPanel } from "@/lbs/website-monitor/audit/WebsiteAuditLinksSocialPanel";
import { WebsiteAuditMetricsPanel } from "@/lbs/website-monitor/audit/WebsiteAuditMetricCards";
import { WebsiteAuditProgressBar } from "@/lbs/website-monitor/audit/WebsiteAuditProgressBar";
import { WebsiteAuditSuggestionsPanel } from "@/lbs/website-monitor/audit/WebsiteAuditSuggestionsPanel";
import { WebsiteAuditAiSummaryPanel } from "@/lbs/website-monitor/audit/WebsiteAuditAiSummaryPanel";
import { WebsiteAuditSeoTechPanel } from "@/lbs/website-monitor/audit/WebsiteAuditSeoTechPanel";
import { WebsiteAuditComparisonPanel } from "@/lbs/website-monitor/audit/WebsiteAuditComparisonPanel";
import { WebsiteAuditGscPanel } from "@/lbs/website-monitor/audit/WebsiteAuditGscPanel";
import { WebsiteAuditResumenPanel } from "@/lbs/website-monitor/audit/WebsiteAuditResumenPanel";
import { buildAuditComparison } from "@/lbs/website-monitor/audit/auditComparison";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  running: "Analizando…",
  done: "Completado",
  failed: "Fallido",
};

const TabCountBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {count}
    </span>
  ) : null;

const scoreDelta = (current?: number | null, previous?: number | null) => {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return "sin cambio";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const SummaryDeviceCard = ({
  label,
  snapshot,
  previousSnapshot,
  onCategoryClick,
}: {
  label: string;
  snapshot: ReturnType<typeof snapshotScores>;
  previousSnapshot?: ReturnType<typeof snapshotScores> | null;
  onCategoryClick?: (category: string) => void;
}) => {
  const delta = scoreDelta(snapshot.overall, previousSnapshot?.overall);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
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
      {onCategoryClick ? (
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Toca Performance, SEO o Best practices para ver el desglose
        </p>
      ) : null}
    </div>
  );
};

const cruxLevelLabel = (audit: WebsiteAudit) => {
  const level = audit.crux_json?.crux_data_level;
  if (!audit.crux_has_data) return null;
  if (level === "origin") return "Datos de campo del dominio completo (CrUX)";
  return "Datos de campo de esta página (CrUX)";
};

const extractDisplayUrl = (url: string) =>
  url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

export const WebsiteAuditReportView = ({
  audit,
  previousAudit,
  previousFindings = [],
  findings,
  showPdfActions = true,
  siteLabel,
  siteId,
}: {
  audit: WebsiteAudit;
  previousAudit?: WebsiteAudit;
  previousFindings?: AuditFinding[];
  findings: AuditFinding[];
  showPdfActions?: boolean;
  siteLabel?: string;
  siteId?: number;
}) => {
  const [tab, setTab] = useState("resumen");
  const [metricsCategory, setMetricsCategory] = useState<string | null>(null);
  const [findingsCategory, setFindingsCategory] = useState<string | null>(null);
  const unified = isUnifiedReport(audit);
  const { mobile, desktop } = getAuditSnapshots(audit);
  const prevSnapshots = previousAudit ? getAuditSnapshots(previousAudit) : null;
  const mobileScores = snapshotScores(mobile);
  const desktopScores = snapshotScores(desktop);
  const cruxLabel = cruxLevelLabel(audit);
  const staticJson = (audit.static_json ?? {}) as StaticAnalysisJson;
  const hasScores = auditHasLighthouseScores(audit);
  const imageIssueCount =
    (staticJson.imagesWithoutAlt ?? staticJson.imagesMissingAlt?.length ?? 0) +
    (staticJson.brokenImages ?? 0);
  const brokenLinkCount = staticJson.brokenLinkCount ?? 0;
  const socialCount = staticJson.socialLinks?.length ?? 0;
  const linkCount =
    staticJson.totalPageLinks ?? staticJson.pageLinks?.length ?? 0;
  const aiSummary = audit.ai_summary_json ?? null;
  const expandedSeoScore = staticJson.expandedSeo?.expandedSeoScore;
  const comparison = buildAuditComparison(
    audit,
    previousAudit,
    findings,
    previousFindings,
  );

  const displayName = siteLabel ?? extractDisplayUrl(audit.audit_url);
  const isDone = audit.status === "done";

  const drillToMetrics = (categoryId: string) => {
    setMetricsCategory(categoryId);
    setTab("metricas");
  };

  return (
    <div className="web-audit-report space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">{displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {extractDisplayUrl(audit.audit_url)} · móvil + desktop
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {isDone ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {STATUS_LABELS.done}
              </span>
            ) : (
              <Badge
                variant={
                  audit.status === "failed" ? "destructive" : "secondary"
                }
              >
                {STATUS_LABELS[audit.status] ?? audit.status}
              </Badge>
            )}
            <span className="text-muted-foreground">
              {formatCheckedAt(audit.completed_at ?? audit.requested_at)}
            </span>
          </div>
        </div>
        {showPdfActions && isDone ? (
          <WebsiteAuditReportActions audit={audit} siteLabel={siteLabel} />
        ) : null}
      </div>

      {audit.status === "failed" && audit.error_message ? (
        <p className="text-sm text-destructive">{audit.error_message}</p>
      ) : null}

      {isDone && staticJson.staticFetchRecovered ? (
        <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-sky-700" />
          <div>
            <p className="font-medium">WAF / bot protection detectado</p>
            <p className="mt-1 text-muted-foreground">
              El hosting bloqueó el fetch automático del worker
              {staticJson.httpStatus ? ` (HTTP ${staticJson.httpStatus})` : ""}.
              Este reporte se generó con navegador Chrome; los datos son
              válidos.
            </p>
          </div>
        </div>
      ) : null}

      {(audit.status === "queued" || audit.status === "running") && (
        <WebsiteAuditProgressBar audit={audit} />
      )}

      {isDone && !hasScores ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Lighthouse no completó este reporte</p>
            <p className="mt-1 text-muted-foreground">
              Regenera el reporte para obtener scores. Mientras tanto revisa
              Imágenes y Hallazgos.
            </p>
          </div>
        </div>
      ) : null}

      {isDone ? (
        unified && mobile && desktop ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList
              className={cn(
                "h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1 print:hidden",
              )}
            >
              <TabsTrigger value="resumen" className="rounded-lg">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="metricas" className="rounded-lg">
                Métricas
              </TabsTrigger>
              <TabsTrigger value="seo-stack" className="rounded-lg">
                SEO & Stack
                {expandedSeoScore != null ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
                    {expandedSeoScore}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="search-console" className="rounded-lg">
                Search Console
              </TabsTrigger>
              <TabsTrigger value="imagenes" className="rounded-lg">
                Imágenes
                <TabCountBadge count={imageIssueCount} />
              </TabsTrigger>
              <TabsTrigger value="presencia" className="rounded-lg">
                Enlaces y redes
                {brokenLinkCount > 0 ? (
                  <TabCountBadge count={brokenLinkCount} />
                ) : linkCount > 0 || socialCount > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
                    {linkCount + socialCount}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="hallazgos" className="rounded-lg">
                Hallazgos
                <TabCountBadge count={findings.length} />
              </TabsTrigger>
              <TabsTrigger value="sugerencias" className="rounded-lg">
                Sugerencias
              </TabsTrigger>
              <TabsTrigger value="evolucion" className="rounded-lg">
                Evolución
                {comparison.hasPrevious ? (
                  <span className="ml-1.5 inline-flex size-2 rounded-full bg-primary" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="ia" className="rounded-lg">
                Resumen IA
                {audit.ai_summary_status === "done" ? (
                  <span className="ml-1.5 inline-flex size-2 rounded-full bg-primary" />
                ) : audit.ai_summary_status === "running" ||
                  audit.ai_summary_status === "pending" ? (
                  <span className="ml-1.5 inline-flex size-2 animate-pulse rounded-full bg-amber-500" />
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="resumen"
              className="mt-6"
              data-print-label="Resumen"
            >
              <WebsiteAuditResumenPanel
                audit={audit}
                aiSummary={aiSummary}
                findings={findings}
                mobileScores={mobileScores}
                desktopScores={desktopScores}
                previousMobileScores={
                  prevSnapshots?.mobile
                    ? snapshotScores(prevSnapshots.mobile)
                    : null
                }
                previousDesktopScores={
                  prevSnapshots?.desktop
                    ? snapshotScores(prevSnapshots.desktop)
                    : null
                }
                hasScores={hasScores}
                onCategoryClick={drillToMetrics}
                staticJson={staticJson}
                cruxLabel={cruxLabel}
              />
            </TabsContent>

            <TabsContent
              value="metricas"
              className="mt-6"
              data-print-label="Métricas"
            >
              <WebsiteAuditMetricsPanel
                mobile={mobile}
                desktop={desktop}
                focusCategory={metricsCategory}
                onFocusCategoryChange={setMetricsCategory}
                aiSummary={aiSummary}
              />
            </TabsContent>

            <TabsContent
              value="seo-stack"
              className="mt-6"
              data-print-label="SEO y stack"
            >
              <WebsiteAuditSeoTechPanel staticJson={staticJson} />
            </TabsContent>

            {siteId != null ? (
              <TabsContent
                value="search-console"
                className="mt-6"
                data-print-label="Search Console"
              >
                <WebsiteAuditGscPanel siteId={siteId} />
              </TabsContent>
            ) : null}

            <TabsContent
              value="imagenes"
              className="mt-6"
              data-print-label="Imágenes"
            >
              <WebsiteAuditImagesPanel staticJson={staticJson} />
            </TabsContent>

            <TabsContent
              value="presencia"
              className="mt-6"
              data-print-label="Enlaces y redes"
            >
              <WebsiteAuditLinksSocialPanel
                staticJson={staticJson}
                auditUrl={audit.audit_url}
                aiSummary={aiSummary}
                linkCount={linkCount}
                brokenLinkCount={brokenLinkCount}
                socialCount={socialCount}
              />
            </TabsContent>

            <TabsContent
              value="hallazgos"
              className="mt-6"
              data-print-label="Hallazgos"
            >
              <WebsiteAuditFindingsPanel
                findings={findings}
                categoryFilter={findingsCategory}
                onCategoryFilterChange={setFindingsCategory}
                onOpenMetrics={(cat) => drillToMetrics(cat)}
                aiSummary={aiSummary}
              />
            </TabsContent>

            <TabsContent
              value="sugerencias"
              className="mt-6"
              data-print-label="Sugerencias"
            >
              <WebsiteAuditSuggestionsPanel
                audit={audit}
                findings={findings}
                aiSummary={aiSummary}
              />
            </TabsContent>

            <TabsContent
              value="evolucion"
              className="mt-6"
              data-print-label="Evolución"
            >
              <WebsiteAuditComparisonPanel
                comparison={comparison}
                previousDate={
                  previousAudit?.requested_at
                    ? formatCheckedAt(previousAudit.requested_at)
                    : null
                }
              />
            </TabsContent>

            <TabsContent
              value="ia"
              className="mt-6"
              data-print-label="Resumen IA"
            >
              <WebsiteAuditAiSummaryPanel audit={audit} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <SummaryDeviceCard
              label="Scores"
              snapshot={
                mobileScores.overall != null ? mobileScores : desktopScores
              }
            />
            <WebsiteAuditImagesPanel staticJson={staticJson} />
            <WebsiteAuditFindingsPanel findings={findings} />
          </>
        )
      ) : null}
    </div>
  );
};
