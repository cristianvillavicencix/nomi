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
  date: string;
  address: string;
  day_state: DayState;
  shifts: ShiftDraft[];
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

export const getDayHours = (day: DayDraft) => {
  if (day.day_state === 'day_off') return 0;
  return Number(
    day.shifts
      .reduce(
        (total, shift) =>
          total + calculateHours(shift.start_time, shift.end_time, shift.lunch_minutes),
        0,
      )
      .toFixed(2),
  );
};

export const getDailyBreakdown = (day: DayDraft) => {
  const total = getDayHours(day);
  const holiday = day.day_state === 'holiday' ? total : 0;
  const regular = day.day_state === 'holiday' ? 0 : Math.min(total, 8);
  const overtime = day.day_state === 'holiday' ? 0 : Math.max(0, total - 8);
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
    date,
    address: '',
    day_state: 'working',
    shifts: [{ start_time: '', end_time: '', lunch_minutes: 0 }],
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
  status,
}: {
  days: DayDraft[];
  employees: Person[];
  projectId: Identifier;
  status: TimeEntry['status'];
}): Array<Omit<TimeEntry, 'id'>> => {
  const payloads: Array<Omit<TimeEntry, 'id'>> = [];

  employees.forEach((employee) => {
    days.forEach((day) => {
      if (day.day_state !== 'working') {
        payloads.push({
          org_id: employee.org_id,
          person_id: employee.id,
          project_id: projectId,
          date: day.date,
          hours: 0,
          start_time: null,
          end_time: null,
          notes: stringifyTimeEntryMeta({
            day_state: day.day_state,
            lunch_minutes: 0,
            address: day.address,
            shift: 1,
          }),
          status,
          created_at: new Date().toISOString(),
        });
        return;
      }

      day.shifts.forEach((shift, shiftIndex) => {
        const hours = calculateHours(
          shift.start_time,
          shift.end_time,
          shift.lunch_minutes,
        );
        if (!hours && !shift.start_time && !shift.end_time) {
          return;
        }

        payloads.push({
          org_id: employee.org_id,
          person_id: employee.id,
          project_id: projectId,
          date: day.date,
          hours,
          start_time: shift.start_time || null,
          end_time: shift.end_time || null,
          notes: stringifyTimeEntryMeta({
            day_state: day.day_state,
            lunch_minutes: shift.lunch_minutes,
            address: day.address,
            shift: shiftIndex + 1,
          }),
          status,
          created_at: new Date().toISOString(),
        });
      });
    });
  });

  return payloads;
};
