import type { Identifier } from 'ra-core';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';
import type { Person, TimeEntry } from '@/components/atomic-crm/types';
import { getPersonDisplayName } from '@/people/constants';

export type DayState = 'working' | 'day_off' | 'holiday';

export type TimeEntryMeta = {
  day_state?: DayState;
  lunch_minutes?: number;
  address?: string;
  shift?: number;
};

export type ShiftDraft = {
  start_time: string;
  end_time: string;
  lunch_minutes: number;
};

export type DayDraft = {
  row_id: string;
  date: string;
  address: string;
  day_state: DayState;
  day_type:
    | 'worked_day'
    | 'holiday'
    | 'sick_day'
    | 'vacation_day'
    | 'day_off'
    | 'unpaid_leave';
  start_time: string;
  end_time: string;
  break_minutes: number;
  project_id?: Identifier | null;
  notes?: string;
  /**
   * Mirrors a time entry already marked paid — do not edit or emit payloads
   * (avoids double-paying the same day).
   */
  paid_day_locked?: boolean;
};

export const createDayRowId = (date: string) =>
  `${date}-${Math.random().toString(36).slice(2, 10)}`;

/** Short English weekday (Sun–Sat) for a calendar date YYYY-MM-DD; ignores browser locale. */
export const enWeekdayShort = (isoDate: string): string => {
  const plain = isoDate.slice(0, 10);
  const parts = plain.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return "";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  return names[date.getDay()];
};

export const employeeOptionText = (person?: Partial<Person>) =>
  person ? getPersonDisplayName(person) : '';

export const parseTimeEntryMeta = (notes?: string | null): TimeEntryMeta => {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes) as TimeEntryMeta;
    return typeof parsed === 'object' && parsed != null ? parsed : {};
  } catch {
    return {};
  }
};

export const stringifyTimeEntryMeta = (meta: TimeEntryMeta) =>
  JSON.stringify(meta);

export const timeStringToMinutes = (value?: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const calculateHours = (
  startTime?: string | null,
  endTime?: string | null,
  lunchMinutes = 0,
) => {
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);
  if (start == null || end == null || end <= start) return 0;
  return Math.max(0, Number(((end - start - lunchMinutes) / 60).toFixed(2)));
};

export const splitRegularOvertimeHours = (hours: number, dailyRegularLimit = 8) => {
  const regular = Math.min(Math.max(hours, 0), dailyRegularLimit);
  const overtime = Math.max(0, hours - dailyRegularLimit);
  return {
    regular: Number(regular.toFixed(2)),
    overtime: Number(overtime.toFixed(2)),
  };
};

const toWeekStartIso = (dateIso: string) => {
  const date = new Date(`${dateIso}T00:00:00`);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
};

export const splitWeeklyRegularOvertimeByDate = (
  days: DayDraft[],
  {
    overtimeEnabled = true,
    weeklyThreshold = 40,
  }: {
    overtimeEnabled?: boolean;
    weeklyThreshold?: number;
  } = {},
) => {
  const breakdownByRowId: Record<
    string,
    { total: number; regular: number; overtime: number }
  > = {};
  const groupedByWeek: Record<
    string,
    Array<{ row_id: string; date: string; hours: number; index: number }>
  > = {};

  for (const [index, day] of days.entries()) {
    const hours =
      day.day_state === 'working' && day.day_type === 'worked_day'
        ? calculateHours(day.start_time, day.end_time, day.break_minutes)
        : 0;

    breakdownByRowId[day.row_id] = {
      total: Number(hours.toFixed(2)),
      regular: Number(hours.toFixed(2)),
      overtime: 0,
    };

    const weekKey = toWeekStartIso(day.date);
    if (!groupedByWeek[weekKey]) {
      groupedByWeek[weekKey] = [];
    }
    groupedByWeek[weekKey].push({ row_id: day.row_id, date: day.date, hours, index });
  }

  if (!overtimeEnabled) {
    return breakdownByRowId;
  }

  for (const entries of Object.values(groupedByWeek)) {
    const sorted = [...entries].sort((a, b) =>
      a.date === b.date ? a.index - b.index : a.date.localeCompare(b.date),
    );
    let accumulatedRegular = 0;
    for (const entry of sorted) {
      const remainingRegular = Math.max(0, weeklyThreshold - accumulatedRegular);
      const regular = Math.min(entry.hours, remainingRegular);
      const overtime = Math.max(0, entry.hours - regular);
      accumulatedRegular += regular;

      breakdownByRowId[entry.row_id] = {
        total: Number(entry.hours.toFixed(2)),
        regular: Number(regular.toFixed(2)),
        overtime: Number(overtime.toFixed(2)),
      };
    }
  }

  return breakdownByRowId;
};

export const getDayHours = (day: DayDraft) => {
  if (day.day_state === 'day_off') return 0;
  return Number(calculateHours(day.start_time, day.end_time, day.break_minutes).toFixed(2));
};

/** Hours for payroll preview; matches buildTimeEntryPayloads (worked shift vs unpaid vs paid absence). */
export const getPayrollHoursForDayDraft = (
  day: DayDraft,
  options?: { defaultPaidHours?: number; offDaysPaid?: boolean },
) => {
  const isWorkedShift =
    day.day_type === 'worked_day' && day.day_state === 'working';
  if (isWorkedShift) {
    return calculateHours(day.start_time, day.end_time, day.break_minutes);
  }
  if (day.day_type === 'unpaid_leave') return 0;
  // "Day off" is only paid if the employee has Off days paid enabled (people.off_days_paid).
  if (day.day_type === 'day_off' && !options?.offDaysPaid) {
    return 0;
  }
  return Number(options?.defaultPaidHours ?? 8);
};

export const getDailyBreakdown = (day: DayDraft) => {
  const total = getDayHours(day);
  if (day.day_state === 'holiday') {
    return { total, regular: 0, overtime: 0, holiday: total };
  }
  const { regular, overtime } = splitRegularOvertimeHours(total);
  const holiday = 0;
  return { total, regular, overtime, holiday };
};

export const getRateForPerson = (person: Person) => {
  switch (person.pay_type) {
    case 'hourly':
      return Number(person.hourly_rate ?? 0);
    case 'day_rate':
      return Number((Number(person.day_rate ?? 0) / 8).toFixed(2));
    case 'salary':
      return 0;
    case 'commission':
      return 0;
    default:
      return 0;
  }
};

export const getRangeDates = (startDate: string, endDate: string) => {
  const result: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return result;
};

export const createDefaultDayDrafts = (startDate: string, endDate: string): DayDraft[] =>
  getRangeDates(startDate, endDate).map((date) => ({
    row_id: createDayRowId(date),
    date,
    address: '',
    day_state: 'working',
    day_type: 'worked_day',
    start_time: '',
    end_time: '',
    break_minutes: 0,
    project_id: null,
    notes: '',
  }));

export const chunkCreateTimeEntries = async (
  dataProvider: CrmDataProvider,
  entries: Array<Omit<TimeEntry, 'id'>>,
  chunkSize = 25,
) => {
  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize);
    await Promise.all(
      chunk.map((data) => dataProvider.create('time_entries', { data })),
    );
  }
};

export const buildTimeEntryPayloads = ({
  days,
  employees,
  projectId,
  workType,
  internalNotes,
  weeklyOvertimeThreshold,
  status,
  paidPersonDateKeys,
}: {
  days: DayDraft[];
  employees: Person[];
  projectId?: Identifier | null;
  workType?: string;
  internalNotes?: string;
  weeklyOvertimeThreshold?: number;
  status: TimeEntry['status'];
  /** Skip person+date keys that already have a paid time entry (e.g. `12|2026-04-01`). */
  paidPersonDateKeys?: Set<string>;
}): Array<Omit<TimeEntry, 'id'>> => {
  const payloads: Array<Omit<TimeEntry, 'id'>> = [];
  const overtimeThreshold = weeklyOvertimeThreshold ?? 40;

  const daysForPayrollCalc = days.filter((d) => !d.paid_day_locked);

  employees.forEach((employee) => {
    const weeklyBreakdown = splitWeeklyRegularOvertimeByDate(daysForPayrollCalc, {
      overtimeEnabled: Boolean(employee.overtime_enabled),
      weeklyThreshold: overtimeThreshold,
    });

    days.forEach((day) => {
      if (day.paid_day_locked) {
        return;
      }
      const dateOnly = day.date.slice(0, 10);
      const lockKey = `${employee.id}|${dateOnly}`;
      if (paidPersonDateKeys?.has(lockKey)) {
        return;
      }
      const isWorkedShift = day.day_type === 'worked_day' && day.day_state === 'working';
      const paidDayDefault = Number(employee.paid_day_hours ?? 8);
      const hours = isWorkedShift
        ? calculateHours(day.start_time, day.end_time, day.break_minutes)
        : day.day_type === 'unpaid_leave'
          ? 0
          : day.day_type === 'day_off' && !employee.off_days_paid
            ? 0
            : paidDayDefault;

      if (!hours && !day.start_time && !day.end_time && isWorkedShift) {
        return;
      }

      const split = weeklyBreakdown[day.row_id] ?? {
        total: Number(hours.toFixed(2)),
        regular: Number(hours.toFixed(2)),
        overtime: 0,
      };

      payloads.push({
        org_id: employee.org_id,
        person_id: employee.id,
        project_id: day.project_id ?? projectId ?? null,
        date: day.date,
        hours,
        lunch_minutes: day.break_minutes,
        break_minutes: day.break_minutes,
        worked_hours_raw: isWorkedShift ? Number((hours + day.break_minutes / 60).toFixed(2)) : 0,
        payable_hours: hours,
        regular_hours: split.regular,
        overtime_hours: split.overtime,
        start_time: isWorkedShift ? day.start_time || null : null,
        end_time: isWorkedShift ? day.end_time || null : null,
        work_location: day.address || null,
        work_type: workType || null,
        day_type: day.day_type,
        notes: stringifyTimeEntryMeta({
          day_state: day.day_state,
          lunch_minutes: day.break_minutes,
          address: day.address,
          shift: 1,
        }),
        internal_notes: internalNotes || day.notes || null,
        status,
        included_in_payroll: false,
        created_at: new Date().toISOString(),
      });
    });
  });

  return payloads;
};
