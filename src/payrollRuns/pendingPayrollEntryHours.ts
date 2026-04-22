import type { TimeEntry } from "@/components/atomic-crm/types";

const paidLeaveDayTypes = new Set([
  "holiday",
  "sick_day",
  "vacation_day",
  "day_off",
]);

/** Split an approved time entry into regular / OT / paid leave for payroll display. */
export const splitPendingPayrollEntryHours = (entry: TimeEntry) => {
  if (paidLeaveDayTypes.has(String(entry.day_type ?? ""))) {
    const ph = Number(entry.payable_hours ?? entry.hours ?? 0);
    return { regular: 0, overtime: 0, paidLeave: ph };
  }
  const h = Number(entry.hours ?? 0);
  if (entry.regular_hours != null || entry.overtime_hours != null) {
    return {
      regular: Number(entry.regular_hours ?? 0),
      overtime: Number(entry.overtime_hours ?? 0),
      paidLeave: 0,
    };
  }
  return {
    regular: Math.min(h, 8),
    overtime: Math.max(0, h - 8),
    paidLeave: 0,
  };
};

/** Same implementation — kept for call sites that still use this name. */
export const splitEntryHours = splitPendingPayrollEntryHours;
