import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditFinding, WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import {
  getAuditSnapshots,
  isUnifiedReport,
  snapshotScores,
} from "@/lbs/website-monitor/audit/auditUtils";
import {
  WebsiteAuditPdfActions,
  WebsiteAuditRunningHint,
} from "@/lbs/website-monitor/audit/WebsiteAuditPdfActions";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";

const STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  running: "Analizando…",
  done: "Completado",
  failed: "Fallido",
};

const SEVERITY_LABELS: Record<string, string> = {
  critico: "Crítico",
  importante: "Importante",
  "nice-to-have": "Mejora",
};

const scoreDelta = (current?: number | null, previous?: number | null) => {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return "sin cambio";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const ScoreCell = ({
  label,
  value,
  previous,
}: {
  label: string;
  value?: number | null;
  previous?: number | null;
}) => {
  const delta = scoreDelta(value, previous);
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {value != null ? value : "—"}
      </p>
      {delta ? (
        <p className="text-xs text-muted-foreground">vs anterior: {delta}</p>
      ) : null}
    </div>
  );
};

const LabCwvLine = ({
  labLcpMs,
  labCls,
  labTbtMs,
}: {
  labLcpMs?: number | null;
  labCls?: number | null;
  labTbtMs?: number | null;
}) => {
  if (labLcpMs == null && labCls == null && labTbtMs == null) return null;
  return (
    <div className="text-xs text-muted-foreground">
      Lab CWV:
      {labLcpMs != null ? ` LCP ${Math.round(Number(labLcpMs))}ms` : ""}
      {labCls != null ? ` · CLS ${Number(labCls).toFixed(3)}` : ""}
      {labTbtMs != null ? ` · TBT ${Math.round(Number(labTbtMs))}ms` : ""}
    </div>
  );
};

const FindingsList = ({ findings }: { findings: AuditFinding[] }) => {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin hallazgos registrados para este reporte.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {findings.slice(0, 16).map((finding) => (
        <li
          key={finding.id}
          className="rounded-md border border-border/60 px-3 py-2 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {SEVERITY_LABELS[finding.severity] ?? finding.severity}
            </Badge>
            <span className="font-medium">{finding.title}</span>
          </div>
          {finding.recommendation ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {finding.recommendation}
            </p>
          ) : null}
          {finding.commercial_message ? (
            <p className="mt-1 text-xs italic text-muted-foreground">
              {finding.commercial_message}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const StrategyScoresPanel = ({
  label,
  snapshot,
  previousSnapshot,
}: {
  label: string;
  snapshot: ReturnType<typeof snapshotScores>;
  previousSnapshot?: ReturnType<typeof snapshotScores> | null;
}) => (
  <div className="space-y-3">
    <p className="text-sm font-medium">{label}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <ScoreCell
        label="Global"
        value={snapshot.overall}
        previous={previousSnapshot?.overall}
      />
      <ScoreCell
        label="Performance"
        value={snapshot.performance}
        previous={previousSnapshot?.performance}
      />
      <ScoreCell
        label="SEO"
        value={snapshot.seo}
        previous={previousSnapshot?.seo}
      />
      <ScoreCell
        label="Best practices"
        value={snapshot.bestPractices}
        previous={previousSnapshot?.bestPractices}
      />
      <ScoreCell
        label="Accessibility"
        value={snapshot.accessibility}
        previous={previousSnapshot?.accessibility}
      />
    </div>
    <LabCwvLine
      labLcpMs={snapshot.labLcpMs}
      labCls={snapshot.labCls}
      labTbtMs={snapshot.labTbtMs}
    />
  </div>
);

const cruxLevelLabel = (audit: WebsiteAudit) => {
  const level = audit.crux_json?.crux_data_level;
  if (!audit.crux_has_data) return null;
  if (level === "origin") return "Datos de campo del dominio completo (CrUX)";
  return "Datos de campo de esta página (CrUX)";
};

export const WebsiteAuditReportView = ({
  audit,
  previousAudit,
  findings,
  showPdfActions = true,
}: {
  audit: WebsiteAudit;
  previousAudit?: WebsiteAudit;
  findings: AuditFinding[];
  showPdfActions?: boolean;
}) => {
  const [tab, setTab] = useState("resumen");
  const unified = isUnifiedReport(audit);
  const { mobile, desktop } = getAuditSnapshots(audit);
  const prevSnapshots = previousAudit ? getAuditSnapshots(previousAudit) : null;
  const mobileScores = snapshotScores(mobile);
  const desktopScores = snapshotScores(desktop);
  const cruxLabel = cruxLevelLabel(audit);

  const strategyLabel = unified
    ? " · móvil + desktop"
    : audit.strategy === "mobile"
      ? " · móvil"
      : " · desktop";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={audit.status === "failed" ? "destructive" : "secondary"}>
            {STATUS_LABELS[audit.status] ?? audit.status}
          </Badge>
          <span className="text-muted-foreground">
            {formatCheckedAt(audit.requested_at)}
            {strategyLabel}
          </span>
        </div>
        {showPdfActions ? <WebsiteAuditPdfActions audit={audit} /> : null}
      </div>

      {audit.status === "failed" && audit.error_message ? (
        <p className="text-sm text-destructive">{audit.error_message}</p>
      ) : null}

      {(audit.status === "queued" || audit.status === "running") && (
        <WebsiteAuditRunningHint />
      )}

      {audit.status === "done" ? (
        unified && mobile && desktop ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="print:hidden">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="mobile">Móvil</TabsTrigger>
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
              <TabsTrigger value="hallazgos">Hallazgos</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4 space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                <p className="font-medium">Score combinado (70% móvil · 30% desktop)</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {audit.overall_score ?? "—"}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <StrategyScoresPanel
                  label="Móvil"
                  snapshot={mobileScores}
                  previousSnapshot={
                    prevSnapshots?.mobile
                      ? snapshotScores(prevSnapshots.mobile)
                      : null
                  }
                />
                <StrategyScoresPanel
                  label="Desktop"
                  snapshot={desktopScores}
                  previousSnapshot={
                    prevSnapshots?.desktop
                      ? snapshotScores(prevSnapshots.desktop)
                      : null
                  }
                />
              </div>
              {audit.crux_has_data ? (
                <div className="text-xs text-muted-foreground">
                  {cruxLabel}:
                  {audit.field_lcp_ms != null
                    ? ` LCP ${Math.round(Number(audit.field_lcp_ms))}ms`
                    : ""}
                  {audit.field_cls != null
                    ? ` · CLS ${Number(audit.field_cls).toFixed(3)}`
                    : ""}
                  {audit.field_inp_ms != null
                    ? ` · INP ${Math.round(Number(audit.field_inp_ms))}ms`
                    : ""}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin datos CrUX de campo (tráfico insuficiente en Chrome).
                </p>
              )}
            </TabsContent>

            <TabsContent value="mobile" className="mt-4">
              <StrategyScoresPanel
                label="Lighthouse + axe (móvil)"
                snapshot={mobileScores}
                previousSnapshot={
                  prevSnapshots?.mobile
                    ? snapshotScores(prevSnapshots.mobile)
                    : null
                }
              />
            </TabsContent>

            <TabsContent value="desktop" className="mt-4">
              <StrategyScoresPanel
                label="Lighthouse + axe (desktop)"
                snapshot={desktopScores}
                previousSnapshot={
                  prevSnapshots?.desktop
                    ? snapshotScores(prevSnapshots.desktop)
                    : null
                }
              />
            </TabsContent>

            <TabsContent value="hallazgos" className="mt-4 space-y-2">
              <p className="text-sm font-medium">Hallazgos prioritarios</p>
              <FindingsList findings={findings} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <StrategyScoresPanel
              label="Scores"
              snapshot={mobileScores.overall != null ? mobileScores : desktopScores}
              previousSnapshot={
                prevSnapshots?.mobile
                  ? snapshotScores(prevSnapshots.mobile)
                  : prevSnapshots?.desktop
                    ? snapshotScores(prevSnapshots.desktop)
                    : null
              }
            />
            {audit.crux_has_data ? (
              <div className="text-xs text-muted-foreground">
                {cruxLabel}:
                {audit.field_lcp_ms != null
                  ? ` LCP ${Math.round(Number(audit.field_lcp_ms))}ms`
                  : ""}
                {audit.field_cls != null
                  ? ` · CLS ${Number(audit.field_cls).toFixed(3)}`
                  : ""}
                {audit.field_inp_ms != null
                  ? ` · INP ${Math.round(Number(audit.field_inp_ms))}ms`
                  : ""}
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Hallazgos prioritarios</p>
              <FindingsList findings={findings} />
            </div>
          </>
        )
      ) : null}
    </div>
  );
};
