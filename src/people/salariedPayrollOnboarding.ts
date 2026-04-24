import type { PayrollRun } from "@/components/atomic-crm/types";

export type SalariedPayrollOnboardingPending = {
  createDraft: true;
  paySchedule: PayrollRun["pay_schedule"];
  periodStart: string;
};

let pending: SalariedPayrollOnboardingPending | null = null;

const toIso = (d: Date) => d.toISOString().slice(0, 10);

const parseLocalDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (![y, mo, d].every(Number.isFinite)) return null;
  return new Date(y, mo, d, 12, 0, 0, 0);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * From the chosen first-day anchor and company pay schedule, build a valid
 * payroll run period (same rules as creating a run manually).
 */
export const buildPayrollPeriodForSchedule = (
  periodStartUser: string,
  paySchedule: PayrollRun["pay_schedule"],
): { pay_period_start: string; pay_period_end: string; payday: string } => {
  const start = parseLocalDate(periodStartUser) ?? new Date();
  if (paySchedule === "weekly") {
    const end = addDays(start, 6);
    const e = toIso(end);
    return { pay_period_start: toIso(start), pay_period_end: e, payday: e };
  }
  if (paySchedule === "biweekly") {
    const end = addDays(start, 13);
    const e = toIso(end);
    return { pay_period_start: toIso(start), pay_period_end: e, payday: e };
  }
  if (paySchedule === "monthly") {
    const s = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0, 0);
    const e = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12, 0, 0, 0);
    const eIso = toIso(e);
    return { pay_period_start: toIso(s), pay_period_end: eIso, payday: eIso };
  }
  // semimonthly: 1–15 or 16–EOM, anchored on the user date
  const day = start.getDate();
  if (day <= 15) {
    const s = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0, 0);
    const e = new Date(start.getFullYear(), start.getMonth(), 15, 12, 0, 0, 0);
    const eIso = toIso(e);
    return { pay_period_start: toIso(s), pay_period_end: eIso, payday: eIso };
  }
  const s = new Date(start.getFullYear(), start.getMonth(), 16, 12, 0, 0, 0);
  const e = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12, 0, 0, 0);
  const eIso = toIso(e);
  return { pay_period_start: toIso(s), pay_period_end: eIso, payday: eIso };
};

const isPaySchedule = (s: string): s is PayrollRun["pay_schedule"] =>
  s === "weekly" || s === "biweekly" || s === "semimonthly" || s === "monthly";

/**
 * Stash form-only fields before save; `normalizePeoplePayload` must strip
 * `create_draft_payroll_run` from the API body. `employment_start_date` is
 * kept on the person; pay cadence is mirrored from org Payment Settings
 * (`pay_schedule` on the form, not the employee re-defining the company).
 */
export const captureSalariedPayrollOnboarding = (raw: Record<string, unknown>) => {
  const type = String(raw.type ?? "employee");
  const unit = String(raw.compensation_unit ?? "hour");
  const salaried = unit === "week" || unit === "month" || unit === "year";
  if (type !== "employee" || !salaried || !raw.create_draft_payroll_run) {
    pending = null;
    return;
  }
  const periodStart = String(raw.employment_start_date ?? "").trim();
  if (!periodStart) {
    pending = null;
    return;
  }
  const ps = String(raw.pay_schedule ?? "biweekly");
  if (!isPaySchedule(ps)) {
    pending = null;
    return;
  }
  pending = {
    createDraft: true,
    paySchedule: ps,
    periodStart,
  };
};

export const consumeSalariedPayrollOnboarding = () => {
  const p = pending;
  pending = null;
  return p;
};

export const buildDraftPayrollRunFromOnboarding = (
  employeeId: number,
  orgId: number,
  payload: SalariedPayrollOnboardingPending,
  createdBy: string,
): Record<string, unknown> => {
  const period = buildPayrollPeriodForSchedule(
    payload.periodStart,
    payload.paySchedule,
  );
  return {
    org_id: orgId,
    category: "salaried",
    pay_schedule: payload.paySchedule,
    pay_period_start: period.pay_period_start,
    pay_period_end: period.pay_period_end,
    payday: period.payday,
    status: "draft",
    employee_id: employeeId,
    created_by: createdBy,
    notes: "Draft from new employee — review when ready.",
  };
};
