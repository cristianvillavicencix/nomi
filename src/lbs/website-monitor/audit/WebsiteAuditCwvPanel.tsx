import type { AuditStrategySnapshot } from "@/lbs/website-monitor/audit/types";
import { snapshotScores } from "@/lbs/website-monitor/audit/auditUtils";
import { LabMetricGauge } from "@/lbs/website-monitor/audit/LabMetricGauge";
import { MetricInfo } from "@/lbs/website-monitor/audit/MetricInfo";
import { ScoreGauge } from "@/lbs/website-monitor/audit/ScoreGauge";

const scoreDelta = (current?: number | null, previous?: number | null) => {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return "sin cambio";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

export const WebsiteAuditCwvPanel = ({
  deviceLabel,
  snapshot,
  previousSnapshot,
}: {
  deviceLabel: string;
  snapshot: AuditStrategySnapshot | null;
  previousSnapshot?: ReturnType<typeof snapshotScores> | null;
}) => {
  const scores = snapshotScores(snapshot);
  const delta = scoreDelta(scores.overall, previousSnapshot?.overall);
  const hasScores =
    scores.overall != null ||
    scores.performance != null ||
    scores.seo != null ||
    scores.bestPractices != null;

  const hasLab =
    scores.labFcpMs != null ||
    scores.labLcpMs != null ||
    scores.labCls != null ||
    scores.labTbtMs != null;

  return (
    <div className="space-y-6">
      {hasScores ? (
        <>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Score global — {deviceLabel}
              </p>
              <MetricInfo tooltipKey="overall" />
              {delta ? (
                <span className="text-xs text-muted-foreground">
                  vs anterior: {delta}
                </span>
              ) : null}
            </div>
            <ScoreGauge
              label=""
              value={scores.overall}
              size="xl"
              tooltipKey="overall"
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="mb-4 text-sm font-semibold">Categorías Lighthouse</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ScoreGauge
                label="Global"
                value={scores.overall}
                tooltipKey="overall"
              />
              <ScoreGauge
                label="Performance"
                value={scores.performance}
                tooltipKey="performance"
              />
              <ScoreGauge label="SEO" value={scores.seo} tooltipKey="seo" />
              <ScoreGauge
                label="Best practices"
                value={scores.bestPractices}
                tooltipKey="bestPractices"
              />
            </div>
          </div>
        </>
      ) : null}

      {hasLab ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold">
            Core Web Vitals — {deviceLabel}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <LabMetricGauge metric="fcp" value={scores.labFcpMs} label="FCP" />
            <LabMetricGauge metric="lcp" value={scores.labLcpMs} label="LCP" />
            <LabMetricGauge metric="cls" value={scores.labCls} label="CLS" />
            {scores.labTbtMs != null ? (
              <LabMetricGauge metric="tbt" value={scores.labTbtMs} label="TBT" />
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin métricas de laboratorio para {deviceLabel.toLowerCase()}. Regenera el
          reporte si acabas de actualizar el worker.
        </p>
      )}
    </div>
  );
};
