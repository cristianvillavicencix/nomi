import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";

/** Worker-reported phases (authoritative when present). */
const WORKER_PHASES: Record<
  string,
  { percent: number; label: string; phaseIndex: number }
> = {
  static: { percent: 12, label: "Análisis estático", phaseIndex: 1 },
  mobile: { percent: 40, label: "Lighthouse móvil", phaseIndex: 2 },
  desktop: { percent: 68, label: "Lighthouse desktop", phaseIndex: 3 },
  crux: { percent: 88, label: "CrUX y hallazgos", phaseIndex: 4 },
};

/** Fallback timeline when worker phase is not yet available (~12 min max). */
const PROGRESS_STEPS = [
  { label: "En cola", untilMs: 30_000, maxPercent: 8 },
  { label: "Análisis estático", untilMs: 90_000, maxPercent: 12 },
  { label: "Lighthouse móvil", untilMs: 360_000, maxPercent: 45 },
  { label: "Lighthouse desktop", untilMs: 630_000, maxPercent: 75 },
  { label: "CrUX y hallazgos", untilMs: 720_000, maxPercent: 92 },
  { label: "Finalizando", untilMs: Number.POSITIVE_INFINITY, maxPercent: 97 },
] as const;

export type AuditProgressSnapshot = {
  percent: number;
  phaseLabel: string;
  phaseIndex: number;
  isComplete: boolean;
  isFailed: boolean;
};

export const getAuditProgress = (
  audit: Pick<
    WebsiteAudit,
    "status" | "requested_at" | "started_at" | "progress_phase"
  >,
  nowMs = Date.now(),
): AuditProgressSnapshot => {
  if (audit.status === "done") {
    return {
      percent: 100,
      phaseLabel: "Completado",
      phaseIndex: PROGRESS_STEPS.length - 1,
      isComplete: true,
      isFailed: false,
    };
  }

  if (audit.status === "failed") {
    return {
      percent: 0,
      phaseLabel: "Fallido",
      phaseIndex: 0,
      isComplete: false,
      isFailed: true,
    };
  }

  const workerPhase = audit.progress_phase
    ? WORKER_PHASES[audit.progress_phase]
    : null;

  if (workerPhase) {
    return {
      percent: workerPhase.percent,
      phaseLabel: workerPhase.label,
      phaseIndex: workerPhase.phaseIndex,
      isComplete: false,
      isFailed: false,
    };
  }

  const startMs = new Date(audit.requested_at).getTime();
  const elapsedMs = Math.max(0, nowMs - startMs);

  let prevMs = 0;
  let prevPercent = 0;

  for (let index = 0; index < PROGRESS_STEPS.length; index += 1) {
    const step = PROGRESS_STEPS[index];
    if (elapsedMs <= step.untilMs) {
      const spanMs =
        step.untilMs === Number.POSITIVE_INFINITY
          ? 120_000
          : step.untilMs - prevMs;
      const t = Math.min(1, (elapsedMs - prevMs) / spanMs);
      const percent = prevPercent + t * (step.maxPercent - prevPercent);

      return {
        percent: Math.round(Math.min(step.maxPercent, Math.max(2, percent))),
        phaseLabel: step.label,
        phaseIndex: index,
        isComplete: false,
        isFailed: false,
      };
    }
    prevMs = step.untilMs;
    prevPercent = step.maxPercent;
  }

  return {
    percent: 97,
    phaseLabel: "Finalizando",
    phaseIndex: PROGRESS_STEPS.length - 1,
    isComplete: false,
    isFailed: false,
  };
};

export const AUDIT_PROGRESS_STEPS = PROGRESS_STEPS.map((step) => step.label);
