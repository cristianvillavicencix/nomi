import { useEffect, useMemo, useRef, useState } from 'react';
import { useDataProvider, useGetList, useGetMany, useNotify, useRefresh } from 'ra-core';
import { Copy, MoreHorizontal, Save, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildTimeEntryPayloads,
  calculateHours,
  createDayRowId,
  chunkCreateTimeEntries,
  createDefaultDayDrafts,
  employeeOptionText,
  enWeekdayShort,
  parseTimeEntryMeta,
  getPayrollHoursForDayDraft,
  getRateForPerson,
  splitWeeklyRegularOvertimeByDate,
  type DayDraft,
  type DayState,
} from './helpers';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';
import type { Company, Person, TimeEntry } from '@/components/atomic-crm/types';
import { compensationTypeLabels, formatMoney } from '@/people/constants';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EntryMode = 'single_day' | 'full_week' | 'custom_range';
type ProjectLite = { id: number; name: string; company_id?: number | null };
type GoogleAddressSuggestion = { placeId: string; text: string };

const GOOGLE_PLACES_API_KEY = 'AIzaSyCOI-vWlZI24dGycSZLoPWEx5_6RTFKkAI';

/** Spanish note in address column when the day is not a worked shift. */
const absentDayAddressNoteEs = (
  dayType: DayDraft['day_type'],
): string | null => {
  switch (dayType) {
    case 'worked_day':
      return null;
    case 'holiday':
      return 'Nota: feriado. No aplica entrada / lunch / salida; se muestran horas y pago del día.';
    case 'sick_day':
      return 'Nota: enfermedad. No aplica entrada / lunch / salida; se muestran horas y pago del día.';
    case 'vacation_day':
      return 'Nota: vacaciones. No aplica entrada / lunch / salida; se muestran horas y pago del día.';
    case 'day_off':
      return 'Nota: día libre. Sin entrada / lunch / salida. El pago depende de «Off days paid» en el empleado (apagado = 0h pagadas; encendido = jornada pagada).';
    case 'unpaid_leave':
      return 'Nota: permiso sin goce. Sin horas ni pago en esta fila.';
    default:
      return null;
  }
};

const dayTypeTooltipText = (dayType: DayDraft['day_type'] | undefined): string => {
  const labels: Record<DayDraft['day_type'], string> = {
    worked_day: 'Worked Day',
    holiday: 'Holiday',
    sick_day: 'Sick Day',
    vacation_day: 'Vacation Day',
    day_off: 'Day Off',
    unpaid_leave: 'Unpaid Leave',
  };
  if (!dayType) return labels.worked_day;
  return labels[dayType] ?? dayType;
};

const normalizeTimeForInput = (value?: string | null) => {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalMinutes = value > 1440 ? Math.round(value / 60) : Math.round(value);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // Accept values like HH:MM, HH:MM:SS or ISO-like datetime strings and normalize to HH:MM
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
};

const addHoursToTime = (startHHMM: string, hours: number) => {
  const [h, m] = startHHMM.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const totalMinutes = startMinutes + Math.round(hours * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const getWeekendType = (dateIso: string) => {
  const day = new Date(`${dateIso}T00:00:00`).getDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return null;
};

const toDateOnly = (value?: string | null) => {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return normalized.slice(0, 10);
};

type ExistingRowSnapshot = {
  entryId: TimeEntry['id'];
  baselineKey: string;
};

const normalizeOptionalString = (value?: string | null) =>
  String(value ?? '').trim();

const normalizeProjectId = (value?: TimeEntry['project_id'] | DayDraft['project_id']) =>
  value == null ? null : String(value);

const dayComparisonKey = (day: DayDraft) =>
  JSON.stringify({
    day_type: day.day_type,
    day_state: day.day_state,
    start_time: normalizeTimeForInput(day.start_time),
    end_time: normalizeTimeForInput(day.end_time),
    break_minutes: Number(day.break_minutes || 0),
    project_id: normalizeProjectId(day.project_id),
    address: normalizeOptionalString(day.address),
    notes: normalizeOptionalString(day.notes),
  });

const deriveDayStateFromType = (dayType?: TimeEntry['day_type']) => {
  if (dayType === 'holiday') return 'holiday' as const;
  if (dayType === 'worked_day') return 'working' as const;
  return 'day_off' as const;
};

const existingEntryComparableKey = (entry: TimeEntry) => {
  const meta = parseTimeEntryMeta(entry.notes);
  const dayType = entry.day_type ?? 'worked_day';
  return JSON.stringify({
    day_type: dayType,
    day_state: meta.day_state ?? deriveDayStateFromType(dayType),
    start_time: normalizeTimeForInput(entry.start_time),
    end_time: normalizeTimeForInput(entry.end_time),
    break_minutes: Number(entry.lunch_minutes ?? entry.break_minutes ?? meta.lunch_minutes ?? 0),
    project_id: normalizeProjectId(entry.project_id),
    address: normalizeOptionalString(entry.work_location ?? meta.address),
    notes: normalizeOptionalString(entry.internal_notes),
  });
};

const payloadComparableKey = (payload: Omit<TimeEntry, 'id'>) => {
  const meta = parseTimeEntryMeta(payload.notes);
  const dayType = payload.day_type ?? 'worked_day';
  return JSON.stringify({
    day_type: dayType,
    day_state: meta.day_state ?? deriveDayStateFromType(dayType),
    start_time: normalizeTimeForInput(payload.start_time),
    end_time: normalizeTimeForInput(payload.end_time),
    break_minutes: Number(payload.lunch_minutes ?? payload.break_minutes ?? meta.lunch_minutes ?? 0),
    project_id: normalizeProjectId(payload.project_id),
    address: normalizeOptionalString(payload.work_location ?? meta.address),
    notes: normalizeOptionalString(payload.internal_notes),
  });
};

export const TimeEntriesBulkCreateModal = ({ open, onOpenChange }: Props) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();

  const today = new Date().toISOString().slice(0, 10);

  const [entryMode, setEntryMode] = useState<EntryMode>('full_week');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeSuggestionsOpen, setEmployeeSuggestionsOpen] = useState(false);
  const [previewEmployeeId, setPreviewEmployeeId] = useState<number | null>(null);
  const [activeAddressRowId, setActiveAddressRowId] = useState<string | null>(null);
  const [googleAddressSuggestions, setGoogleAddressSuggestions] = useState<GoogleAddressSuggestion[]>([]);
  const [isLoadingGoogleSuggestions, setIsLoadingGoogleSuggestions] = useState(false);
  const [days, setDays] = useState<DayDraft[]>(createDefaultDayDrafts(today, today));
  const [existingEntries, setExistingEntries] = useState<TimeEntry[]>([]);
  const [existingRowsById, setExistingRowsById] = useState<Record<string, ExistingRowSnapshot>>({});
  const [modifiedExistingRowsById, setModifiedExistingRowsById] = useState<Record<string, boolean>>({});
  const [isLoadingExistingEntries, setIsLoadingExistingEntries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const employeeInputClickedRef = useRef(false);
  const prefilledKeyRef = useRef<string>('');

  const { data: employees = [] } = useGetList<Person>('people', {
    pagination: { page: 1, perPage: 400 },
    sort: { field: 'first_name', order: 'ASC' },
    filter: { type: 'employee', status: 'active' },
  });
  const { data: projects = [] } = useGetList<ProjectLite>('deals', {
    pagination: { page: 1, perPage: 500 },
    sort: { field: 'name', order: 'ASC' },
    filter: { 'archived_at@is': null },
  });
  const projectCompanyIds = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => project.company_id)
            .filter((companyId): companyId is number => companyId != null),
        ),
      ),
    [projects],
  );
  const { data: projectCompanies = [] } = useGetMany<Company>(
    'companies',
    { ids: projectCompanyIds },
    { enabled: projectCompanyIds.length > 0 },
  );
  const companyById = useMemo(
    () => Object.fromEntries(projectCompanies.map((company) => [Number(company.id), company])),
    [projectCompanies],
  );
  const projectAddressOptions = useMemo(
    () =>
      projects
        .map((project) => {
          const company = project.company_id ? companyById[Number(project.company_id)] : undefined;
          const address = [
            company?.address,
            company?.city,
            company?.state_abbr,
            company?.zipcode,
          ]
            .filter(Boolean)
            .join(', ')
            .trim();
          return {
            projectId: project.id,
            label: `${project.name} — ${address}`,
            address,
          };
        })
        .filter((option) => option.address),
    [companyById, projects],
  );
  const activeAddressQuery = useMemo(() => {
    if (!activeAddressRowId) return '';
    const row = days.find((day) => day.row_id === activeAddressRowId);
    return String(row?.address ?? '').trim();
  }, [activeAddressRowId, days]);
  const filteredProjectAddressOptions = useMemo(() => {
    const query = activeAddressQuery.toLowerCase();
    if (!query) return projectAddressOptions.slice(0, 8);
    return projectAddressOptions
      .filter(
        (option) =>
          option.label.toLowerCase().includes(query) ||
          option.address.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [activeAddressQuery, projectAddressOptions]);

  useEffect(() => {
    if (!open || !activeAddressRowId) {
      setGoogleAddressSuggestions([]);
      setIsLoadingGoogleSuggestions(false);
      return;
    }
    if (activeAddressQuery.length < 3) {
      setGoogleAddressSuggestions([]);
      setIsLoadingGoogleSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoadingGoogleSuggestions(true);
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
          },
          body: JSON.stringify({
            input: activeAddressQuery,
            languageCode: 'en',
            regionCode: 'US',
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          setGoogleAddressSuggestions([]);
          return;
        }
        const json = (await response.json()) as {
          suggestions?: Array<{
            placePrediction?: {
              placeId?: string;
              text?: { text?: string };
            };
          }>;
        };
        const nextSuggestions =
          json.suggestions
            ?.map((item) => ({
              placeId: String(item.placePrediction?.placeId ?? ''),
              text: String(item.placePrediction?.text?.text ?? ''),
            }))
            .filter((item) => item.placeId && item.text) ?? [];
        setGoogleAddressSuggestions(nextSuggestions.slice(0, 6));
      } catch {
        setGoogleAddressSuggestions([]);
      } finally {
        setIsLoadingGoogleSuggestions(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeAddressQuery, activeAddressRowId, open]);

  const selectedEmployeeIdsKey = selectedEmployeeIds.slice().sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (entryMode === 'single_day') {
      setEndDate(startDate);
      return;
    }
    if (entryMode === 'full_week') {
      const next = new Date(`${startDate}T00:00:00`);
      next.setDate(next.getDate() + 6);
      setEndDate(next.toISOString().slice(0, 10));
    }
  }, [entryMode, startDate]);

  useEffect(() => {
    setDays((previousDays) => {
      const template = createDefaultDayDrafts(startDate, endDate);
      const allowedDates = new Set(template.map((item) => item.date));
      const keptRows = previousDays
        .filter((row) => allowedDates.has(row.date))
        .map((row) => ({
          ...row,
          address: row.address || '',
          project_id: row.project_id ?? null,
        }));

      const missingRows = template
        .filter((row) => !keptRows.some((kept) => kept.date === row.date))
        .map((row) => ({
          ...row,
          address: '',
          project_id: null,
        }));

      return [...keptRows, ...missingRows].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    });
    setExistingRowsById({});
    setModifiedExistingRowsById({});
    prefilledKeyRef.current = '';
  }, [startDate, endDate]);

  const existingEntriesSignature = useMemo(
    () =>
      existingEntries
        .map((entry) => `${entry.id}:${toDateOnly(entry.date)}`)
        .join('|'),
    [existingEntries],
  );

  useEffect(() => {
    if (!open || selectedEmployeeIds.length === 0) {
      setExistingEntries([]);
      setExistingRowsById({});
      setModifiedExistingRowsById({});
      setIsLoadingExistingEntries(false);
      prefilledKeyRef.current = '';
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      setExistingEntries([]);
      setExistingRowsById({});
      setModifiedExistingRowsById({});
      setIsLoadingExistingEntries(false);
      prefilledKeyRef.current = '';
      return;
    }
    let cancelled = false;
    const fetchExisting = async () => {
      if (!cancelled) {
        setIsLoadingExistingEntries(true);
      }
      try {
        const responses = await Promise.all(
          selectedEmployeeIds.map((employeeId) =>
            dataProvider.getList<TimeEntry>('time_entries', {
              pagination: { page: 1, perPage: 2000 },
              sort: { field: 'date', order: 'DESC' },
              filter: {
                'person_id@eq': employeeId,
                'date@gte': startDate,
                'date@lte': endDate,
              },
            }),
          ),
        );
        const data = responses.flatMap((response) => response.data);
        if (!cancelled) {
          const selectedIds = new Set(selectedEmployeeIds.map((id) => Number(id)));
          const normalized = data
            .map((entry) => ({
              ...entry,
              date: toDateOnly(entry.date),
            }))
            .filter((entry) => {
              if (!selectedIds.has(Number(entry.person_id))) return false;
              if (!entry.date) return false;
              return entry.date >= startDate && entry.date <= endDate;
            });
          setExistingEntries(normalized);
        }
      } catch {
        if (!cancelled) {
          setExistingEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExistingEntries(false);
        }
      }
    };
    fetchExisting();
    return () => {
      cancelled = true;
    };
  }, [open, dataProvider, selectedEmployeeIdsKey, startDate, endDate, selectedEmployeeIds]);

  useEffect(() => {
    if (!open || selectedEmployeeIds.length === 0) return;
    const targetEmployeeId = previewEmployeeId ?? selectedEmployeeIds[0];
    if (targetEmployeeId == null) return;
    const key = `${targetEmployeeId}-${startDate}-${endDate}-${existingEntriesSignature}`;
    if (prefilledKeyRef.current === key) return;
    prefilledKeyRef.current = key;

    const existingByDate = new Map<string, TimeEntry[]>();
    for (const entry of existingEntries) {
      if (Number(entry.person_id) !== Number(targetEmployeeId)) continue;
      const entryDate = toDateOnly(entry.date);
      const bucket = existingByDate.get(entryDate) ?? [];
      bucket.push(entry);
      existingByDate.set(entryDate, bucket);
    }
    if (existingByDate.size === 0) {
      setExistingRowsById({});
      setModifiedExistingRowsById({});
      return;
    }

    const nextExistingRowsById: Record<string, ExistingRowSnapshot> = {};
    const nextModifiedRowsById: Record<string, boolean> = {};
    setDays((currentDays) => {
      const nextDays = currentDays.map((day) => {
        const bucket = existingByDate.get(day.date);
        if (!bucket || bucket.length === 0) return day;
        const sorted = [...bucket].sort(
          (a, b) =>
            (a.status === 'paid' ? 1 : 0) - (b.status === 'paid' ? 1 : 0),
        );
        const entry = sorted[0];
        const paidDayLocked = entry.status === 'paid';
        const legacyEntry = entry as TimeEntry & {
          clock_in?: string | number | null;
          clock_out?: string | number | null;
          lunch_break?: number | string | null;
          note?: string | null;
          project?: number | string | null;
        };
        const meta = parseTimeEntryMeta(entry.notes);
        const dayType = entry.day_type ?? day.day_type;
        const nextDayState: DayState =
          dayType === 'worked_day'
            ? 'working'
            : dayType === 'holiday'
              ? 'holiday'
              : 'day_off';
        const normalizedStart = normalizeTimeForInput(legacyEntry.clock_in ?? entry.start_time);
        const normalizedEnd = normalizeTimeForInput(legacyEntry.clock_out ?? entry.end_time);
        const breakMinutes = Number(
          legacyEntry.lunch_break ??
            entry.lunch_minutes ??
            entry.break_minutes ??
            meta.lunch_minutes ??
            0,
        );
        const payableCandidate = Number(entry.payable_hours ?? Number.NaN);
        const hoursCandidate = Number(entry.hours ?? Number.NaN);
        const payableHours = Number(
          Number.isFinite(payableCandidate) && payableCandidate > 0
            ? payableCandidate
            : Number.isFinite(hoursCandidate) && hoursCandidate > 0
              ? hoursCandidate
              : 0,
        );
        // Backward-compatible prefill: if legacy entries don't have start/end, infer a base shift for editing.
        const fallbackStart = payableHours > 0 ? '08:00' : '';
        const fallbackEnd =
          payableHours > 0 ? addHoursToTime(fallbackStart, payableHours + breakMinutes / 60) : '';
        const nextDay: DayDraft = {
          ...day,
          day_type: dayType,
          day_state: meta.day_state ?? nextDayState,
          start_time: normalizedStart || fallbackStart,
          end_time: normalizedEnd || fallbackEnd,
          break_minutes: breakMinutes,
          project_id: entry.project_id ?? (legacyEntry.project as number | string | null) ?? null,
          address: String(entry.work_location ?? meta.address ?? day.address ?? ''),
          notes: String(legacyEntry.note ?? entry.internal_notes ?? day.notes ?? ''),
          paid_day_locked: paidDayLocked,
        };
        if (!paidDayLocked) {
          nextExistingRowsById[day.row_id] = {
            entryId: entry.id,
            baselineKey: dayComparisonKey(nextDay),
          };
          nextModifiedRowsById[day.row_id] = false;
        }
        return nextDay;
      });
      return nextDays;
    });
    setExistingRowsById(nextExistingRowsById);
    setModifiedExistingRowsById(nextModifiedRowsById);
  }, [
    open,
    selectedEmployeeIdsKey,
    selectedEmployeeIds,
    previewEmployeeId,
    existingEntries,
    existingEntriesSignature,
    startDate,
    endDate,
  ]);

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedEmployeeIds.includes(employee.id)),
    [employees, selectedEmployeeIds],
  );

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    if (!search) return employees;
    return employees.filter((employee) => {
      const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`
        .trim()
        .toLowerCase();
      const email = String(employee.email ?? '').toLowerCase();
      return fullName.includes(search) || email.includes(search);
    });
  }, [employeeSearch, employees]);

  useEffect(() => {
    if (!selectedEmployees.length) {
      setPreviewEmployeeId(null);
      return;
    }
    if (
      previewEmployeeId == null ||
      !selectedEmployees.some((employee) => employee.id === previewEmployeeId)
    ) {
      setPreviewEmployeeId(selectedEmployees[0].id);
    }
  }, [previewEmployeeId, selectedEmployees]);

  const previewEmployee =
    selectedEmployees.find((employee) => employee.id === previewEmployeeId) ??
    selectedEmployees[0];
  const hasExistingForPreviewEmployee = Boolean(
    previewEmployee &&
      existingEntries.some(
        (entry) => Number(entry.person_id) === Number(previewEmployee.id),
      ),
  );
  const existingEntriesCountInRange = existingEntries.length;

  const paidPersonDateKeys = useMemo(
    () =>
      new Set(
        existingEntries
          .filter((e) => e.status === 'paid')
          .map((e) => `${e.person_id}|${toDateOnly(e.date)}`),
      ),
    [existingEntries],
  );

  /** Rows that are not locked to a paid time entry (footer / payloads only). */
  const daysForEditablePay = useMemo(
    () => days.filter((d) => !d.paid_day_locked),
    [days],
  );

  const previewOvertimeEnabled = Boolean(previewEmployee?.overtime_enabled);
  const previewBreakdownByDate = useMemo(
    () =>
      splitWeeklyRegularOvertimeByDate(daysForEditablePay, {
        overtimeEnabled: previewOvertimeEnabled,
        weeklyThreshold: 40,
      }),
    [daysForEditablePay, previewOvertimeEnabled],
  );

  const totals = useMemo(() => {
    const totalPayableHours = daysForEditablePay.reduce(
      (sum, day) =>
        sum +
        getPayrollHoursForDayDraft(day, {
          defaultPaidHours: Number(previewEmployee?.paid_day_hours ?? 8),
          offDaysPaid: Boolean(previewEmployee?.off_days_paid),
        }),
      0,
    );

    const aggregate = selectedEmployees.reduce(
      (acc, employee) => {
        const breakdown = splitWeeklyRegularOvertimeByDate(daysForEditablePay, {
          overtimeEnabled: Boolean(employee.overtime_enabled),
          weeklyThreshold: 40,
        });
        const defaultPaid = Number(employee.paid_day_hours ?? 8);
        for (const day of daysForEditablePay) {
          const worked =
            day.day_type === 'worked_day' && day.day_state === 'working';
          const split = breakdown[day.row_id];
          if (worked && split) {
            acc.regular += split.regular;
            acc.overtime += split.overtime;
          } else if (!worked && day.day_type !== 'unpaid_leave') {
            acc.regular += getPayrollHoursForDayDraft(day, {
              defaultPaidHours: defaultPaid,
              offDaysPaid: Boolean(employee.off_days_paid),
            });
          }
        }
        return acc;
      },
      { regular: 0, overtime: 0 },
    );

    const estimatedGross = selectedEmployees.reduce((sum, employee) => {
      const compensationType = employee.compensation_type ?? employee.pay_type;
      if (compensationType !== 'hourly') return sum;
      const breakdown = splitWeeklyRegularOvertimeByDate(daysForEditablePay, {
        overtimeEnabled: Boolean(employee.overtime_enabled),
        weeklyThreshold: 40,
      });
      const defaultPaid = Number(employee.paid_day_hours ?? 8);
      let regularHours = 0;
      let overtimeHours = 0;
      for (const day of daysForEditablePay) {
        const worked =
          day.day_type === 'worked_day' && day.day_state === 'working';
        if (worked) {
          regularHours += breakdown[day.row_id]?.regular ?? 0;
          overtimeHours += breakdown[day.row_id]?.overtime ?? 0;
        } else if (day.day_type !== 'unpaid_leave') {
          regularHours += getPayrollHoursForDayDraft(day, {
            defaultPaidHours: defaultPaid,
            offDaysPaid: Boolean(employee.off_days_paid),
          });
        }
      }
      const rate = Number(employee.hourly_rate ?? 0);
      const overtimeMultiplier = Number(employee.overtime_rate_multiplier ?? 1.5);
      return sum + regularHours * rate + overtimeHours * rate * overtimeMultiplier;
    }, 0);

    const employeeCount = selectedEmployees.length || 1;
    return {
      regular: Number(aggregate.regular.toFixed(2)),
      overtime: Number(aggregate.overtime.toFixed(2)),
      total: Number((totalPayableHours * employeeCount).toFixed(2)),
      estimatedGross: Number(estimatedGross.toFixed(2)),
    };
  }, [
    daysForEditablePay,
    selectedEmployees,
    previewEmployee?.paid_day_hours,
    previewEmployee?.off_days_paid,
  ]);

  const employeeTotals = useMemo(() => {
    const totalsByEmployee = selectedEmployees.reduce(
      (acc, employee) => {
        const breakdown = splitWeeklyRegularOvertimeByDate(daysForEditablePay, {
          overtimeEnabled: Boolean(employee.overtime_enabled),
          weeklyThreshold: 40,
        });
        const defaultPaid = Number(employee.paid_day_hours ?? 8);
        const totalHours = daysForEditablePay.reduce(
          (sum, day) =>
            sum +
            getPayrollHoursForDayDraft(day, {
              defaultPaidHours: defaultPaid,
              offDaysPaid: Boolean(employee.off_days_paid),
            }),
          0,
        );
        let regularHours = 0;
        let overtimeHours = 0;
        for (const day of daysForEditablePay) {
          const worked =
            day.day_type === 'worked_day' && day.day_state === 'working';
          if (worked) {
            regularHours += breakdown[day.row_id]?.regular ?? 0;
            overtimeHours += breakdown[day.row_id]?.overtime ?? 0;
          } else if (day.day_type !== 'unpaid_leave') {
            regularHours += getPayrollHoursForDayDraft(day, {
              defaultPaidHours: defaultPaid,
              offDaysPaid: Boolean(employee.off_days_paid),
            });
          }
        }
        const rate = Number(employee.hourly_rate ?? 0);
        const overtimeMultiplier = Number(employee.overtime_rate_multiplier ?? 1.5);
        const pay =
          (employee.compensation_type ?? employee.pay_type) === 'hourly'
            ? regularHours * rate + overtimeHours * rate * overtimeMultiplier
            : 0;
        acc[employee.id] = {
          totalHours: Number(totalHours.toFixed(2)),
          regularHours: Number(regularHours.toFixed(2)),
          overtimeHours: Number(overtimeHours.toFixed(2)),
          pay: Number(pay.toFixed(2)),
          rate,
        };
        return acc;
      },
      {} as Record<
        number,
        {
          totalHours: number;
          regularHours: number;
          overtimeHours: number;
          pay: number;
          rate: number;
        }
      >,
    );
    return totalsByEmployee;
  }, [daysForEditablePay, selectedEmployees]);

  const previewSummary =
    previewEmployee && employeeTotals[previewEmployee.id]
      ? employeeTotals[previewEmployee.id]
      : null;

  const footerTotals = previewSummary
    ? {
        total: previewSummary.totalHours,
        regular: previewSummary.regularHours,
        overtime: previewSummary.overtimeHours,
        pay: previewSummary.pay,
      }
    : {
        total: totals.total,
        regular: totals.regular,
        overtime: totals.overtime,
      pay: totals.estimatedGross,
      };

  const existingDuplicateByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of existingEntries) {
      const key = `${entry.person_id}|${toDateOnly(entry.date)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicatesByDate = new Map<string, number>();
    for (const [key, count] of counts.entries()) {
      if (count <= 1) continue;
      const [, date] = key.split('|');
      duplicatesByDate.set(date, Math.max(duplicatesByDate.get(date) ?? 0, count));
    }
    return duplicatesByDate;
  }, [existingEntries]);

  const rowIssues = useMemo(() => {
    const issuesByRow: Record<string, string[]> = {};
    const addIssue = (rowId: string, message: string) => {
      if (!issuesByRow[rowId]) issuesByRow[rowId] = [];
      if (!issuesByRow[rowId].includes(message)) issuesByRow[rowId].push(message);
    };
    const toMinutes = (value?: string) => {
      if (!value) return null;
      const [h, m] = value.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };

    for (const day of days) {
      if (day.paid_day_locked) continue;
      if (day.day_state !== 'working' || day.day_type !== 'worked_day') continue;
      const hasPartialTime = Boolean(day.start_time) !== Boolean(day.end_time);
      if (hasPartialTime) {
        addIssue(day.row_id, 'Missing start or end time');
      }
      if (day.start_time && day.end_time && calculateHours(day.start_time, day.end_time, day.break_minutes) <= 0) {
        addIssue(day.row_id, 'End time must be after start');
      }
    }

    const workedRows = days.filter(
      (day) =>
        !day.paid_day_locked &&
        day.day_type === 'worked_day' &&
        day.day_state === 'working' &&
        day.start_time &&
        day.end_time,
    );
    const byDate = new Map<string, DayDraft[]>();
    for (const row of workedRows) {
      const bucket = byDate.get(row.date) ?? [];
      bucket.push(row);
      byDate.set(row.date, bucket);
    }
    for (const rows of byDate.values()) {
      const sorted = [...rows].sort((a, b) => {
        const aStart = toMinutes(a.start_time) ?? 0;
        const bStart = toMinutes(b.start_time) ?? 0;
        return aStart - bStart;
      });
      for (let i = 1; i < sorted.length; i += 1) {
        const prevEnd = toMinutes(sorted[i - 1].end_time) ?? 0;
        const currentStart = toMinutes(sorted[i].start_time) ?? 0;
        if (currentStart < prevEnd) {
          addIssue(sorted[i - 1].row_id, 'Overlapping shift');
          addIssue(sorted[i].row_id, 'Overlapping shift');
        }
      }
    }

    for (const day of days) {
      const duplicateCount = existingDuplicateByDate.get(day.date);
      if (duplicateCount && duplicateCount > 1) {
        addIssue(day.row_id, `${duplicateCount} shifts existing`);
      }
    }

    return issuesByRow;
  }, [days, existingDuplicateByDate]);

  const warnings = useMemo(() => {
    const nextWarnings: string[] = [];
    if (!selectedEmployees.length) {
      nextWarnings.push('Select at least one employee.');
    }

    return nextWarnings;
  }, [days, selectedEmployees.length]);

  const updateDay = (
    rowId: string,
    updater: (day: DayDraft) => DayDraft,
    options?: { markModified?: boolean },
  ) => {
    const markModified = options?.markModified ?? true;
    setDays((current) => {
      const target = current.find((d) => d.row_id === rowId);
      if (target?.paid_day_locked) {
        return current;
      }
      const next = current.map((day) => (day.row_id === rowId ? updater(day) : day));
      return next;
    });
    if (markModified && existingRowsById[rowId]) {
      setModifiedExistingRowsById((current) => ({ ...current, [rowId]: true }));
    }
  };

  const toggleEmployee = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds((current) =>
      checked ? [...current, employeeId] : current.filter((id) => id !== employeeId),
    );
    if (checked) {
      setEmployeeSearch('');
    }
  };

  const addEmployeeFromSearch = () => {
    const candidate = filteredEmployees.find(
      (employee) => !selectedEmployeeIds.includes(employee.id),
    );
    if (!candidate) return;
    toggleEmployee(candidate.id, true);
    setEmployeeSearch('');
  };

  const applyFirstDayScheduleToAll = () => {
    const first = days[0];
    if (!first) return;
    setDays((current) =>
      current.map((day, index) =>
        index === 0 || day.paid_day_locked
          ? day
          : {
              ...day,
              start_time: first.start_time,
              end_time: first.end_time,
              break_minutes: first.break_minutes,
              project_id: first.project_id ?? null,
              notes: first.notes ?? '',
              address: first.address ?? '',
            },
      ),
    );
  };

  const duplicateShiftRow = (rowId: string) => {
    setDays((current) => {
      const index = current.findIndex((row) => row.row_id === rowId);
      if (index < 0) return current;
      const source = current[index];
      if (source.paid_day_locked) {
        notify('No se puede duplicar un día ya pagado.', { type: 'warning' });
        return current;
      }
      const duplicated: DayDraft = {
        ...source,
        row_id: createDayRowId(source.date),
        start_time: '',
        end_time: '',
        break_minutes: 0,
      };
      const next = [...current];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const deleteShiftRow = (rowId: string) => {
    const row = days.find((d) => d.row_id === rowId);
    if (row?.paid_day_locked) {
      notify('No se puede eliminar un día ya pagado desde aquí.', { type: 'warning' });
      return;
    }
    if (days.length <= 1) {
      notify('Debe existir al menos una fila.', { type: 'warning' });
      return;
    }
    setDays((current) => current.filter((r) => r.row_id !== rowId));
  };

  const convertRowDayType = (
    rowId: string,
    dayType: DayDraft['day_type'],
  ) => {
    const row = days.find((d) => d.row_id === rowId);
    if (row?.paid_day_locked) {
      notify('No se puede cambiar el tipo de un día ya pagado.', { type: 'warning' });
      return;
    }
    updateDay(rowId, (currentDay) => {
      const nextDayState: DayState =
        dayType === 'worked_day'
          ? 'working'
          : dayType === 'holiday'
            ? 'holiday'
            : 'day_off';

      return {
        ...currentDay,
        day_type: dayType,
        day_state: nextDayState,
        start_time: dayType === 'worked_day' ? currentDay.start_time : '',
        end_time: dayType === 'worked_day' ? currentDay.end_time : '',
        break_minutes: dayType === 'worked_day' ? currentDay.break_minutes : 0,
      };
    });
  };

  const validateDays = () => {
    if (Object.keys(rowIssues).length > 0) {
      notify('Fix highlighted rows before saving.', { type: 'warning' });
      return false;
    }
    return true;
  };

  const handleSave = async (status: TimeEntry['status']) => {
    if (!selectedEmployees.length) {
      notify('Select at least one employee', { type: 'error' });
      return;
    }
    if (!validateDays()) return;

    const payloads = buildTimeEntryPayloads({
      days,
      employees: selectedEmployees,
      projectId: null,
      status,
      paidPersonDateKeys,
    });

    if (!payloads.length) {
      notify('No time entries to create', { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const existingQueues = new Map<string, TimeEntry[]>();
      for (const entry of existingEntries) {
        const key = `${entry.person_id}-${toDateOnly(entry.date)}`;
        const bucket = existingQueues.get(key) ?? [];
        bucket.push(entry);
        existingQueues.set(key, bucket);
      }

      const creates: Array<Omit<TimeEntry, 'id'>> = [];
      const updates: Array<{ id: TimeEntry['id']; previousData: TimeEntry; data: Partial<TimeEntry> }> = [];
      let skipped = 0;

      for (const payload of payloads) {
        const key = `${payload.person_id}-${payload.date}`;
        const queue = existingQueues.get(key);
        const existing = queue && queue.length > 0 ? queue.shift() : null;
        if (existing) {
          if (existing.status === 'paid') {
            skipped += 1;
            continue;
          }
          const unchanged = existingEntryComparableKey(existing) === payloadComparableKey(payload);
          if (unchanged) {
            skipped += 1;
            continue;
          }
          const { created_at, ...updateData } = payload;
          updates.push({
            id: existing.id,
            previousData: existing,
            data: updateData,
          });
        } else {
          creates.push(payload);
        }
      }

      for (let index = 0; index < updates.length; index += 25) {
        const chunk = updates.slice(index, index + 25);
        await Promise.all(
          chunk.map((update) =>
            dataProvider.update<TimeEntry>('time_entries', {
              id: update.id,
              previousData: update.previousData,
              data: update.data,
            }),
          ),
        );
      }
      if (creates.length > 0) {
        await chunkCreateTimeEntries(dataProvider, creates);
      }
      notify(
        status === 'submitted'
          ? `${payloads.length} entries submitted (${updates.length} updated, ${creates.length} created, ${skipped} skipped)`
          : `${payloads.length} entries saved (${updates.length} updated, ${creates.length} created, ${skipped} skipped)`,
      );
      refresh();
      onOpenChange(false);
      setSelectedEmployeeIds([]);
    } catch {
      notify('Could not create time entries', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] md:w-[min(96vw,1800px)] max-h-[92vh] max-w-[1800px] flex-col overflow-hidden rounded-xl border bg-background p-0 sm:!max-w-[1800px]">
        <DialogHeader className="border-b bg-background px-4 py-4 md:px-6 md:py-5">
          <DialogTitle className="text-[34px] font-semibold leading-none tracking-tight">Nuevo Registro</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground md:text-base">
            Registro rápido por día o por semana completa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block text-sm font-medium text-muted-foreground">Empleado</Label>
                <div className="relative">
                  <div className="flex min-h-12 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {selectedEmployees.map((employee) => (
                      <span
                        key={employee.id}
                        className="inline-flex h-7 items-center gap-1 rounded-md border bg-muted px-2 text-[11px] uppercase tracking-wide text-muted-foreground"
                      >
                        {employeeOptionText(employee)}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => toggleEmployee(employee.id, false)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                      <Input
                        className="h-9 min-w-[220px] flex-1 border-0 bg-transparent px-1 text-base shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0"
                        placeholder="Buscar empleado..."
                        value={employeeSearch}
                        onChange={(event) => setEmployeeSearch(event.target.value)}
                        onMouseDown={() => {
                          employeeInputClickedRef.current = true;
                        }}
                        onFocus={() => {
                          if (employeeInputClickedRef.current) {
                            setEmployeeSuggestionsOpen(true);
                          }
                          employeeInputClickedRef.current = false;
                        }}
                        onClick={() => setEmployeeSuggestionsOpen(true)}
                        onBlur={() => {
                          setTimeout(() => setEmployeeSuggestionsOpen(false), 120);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addEmployeeFromSearch}
                      disabled={!filteredEmployees.some((e) => !selectedEmployeeIds.includes(e.id))}
                      className="h-9 w-9 rounded-md border border-border text-xl leading-none"
                    >
                      +
                    </Button>
                  </div>
                  {employeeSuggestionsOpen ? (
                    <div className="absolute top-[calc(100%+6px)] z-40 max-h-40 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-md">
                      {filteredEmployees.slice(0, 8).map((employee) => {
                        const compensationType = employee.compensation_type ?? employee.pay_type;
                        return (
                          <label
                            key={employee.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={selectedEmployeeIds.includes(employee.id)}
                              onCheckedChange={(checked) => {
                                toggleEmployee(employee.id, checked === true);
                              }}
                            />
                            <span className="text-sm">{employeeOptionText(employee)}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {compensationTypeLabels[compensationType as keyof typeof compensationTypeLabels] ?? compensationType}
                              {' · '}
                              {formatMoney(getRateForPerson(employee))}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedEmployees.length > 0
                    ? `${selectedEmployees.length} empleado(s) seleccionados`
                    : 'Selecciona al menos un empleado.'}
                </div>
                {existingEntriesCountInRange > 0 && !isLoadingExistingEntries ? (
                  <div className="mt-1 text-xs text-primary">
                    Se encontraron {existingEntriesCountInRange} registros existentes en este rango. Puedes editarlos antes de guardar.
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Modo</Label>
                <Tabs value={entryMode} onValueChange={(value) => setEntryMode(value as EntryMode)}>
                  <TabsList className="grid w-full max-w-[520px] grid-cols-3">
                    <TabsTrigger value="single_day">Single Day</TabsTrigger>
                    <TabsTrigger value="full_week">Full Week</TabsTrigger>
                    <TabsTrigger value="custom_range">Custom Range</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Rango</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    className="h-10 rounded-md bg-background"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-10 rounded-md bg-background"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={entryMode !== 'custom_range'}
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Daily Time Grid</p>
                    <p className="text-xs text-muted-foreground">
                      Overtime semanal de 40h (solo si el empleado tiene overtime habilitado).
                    </p>
                    {hasExistingForPreviewEmployee && previewEmployee ? (
                      <p className="mt-1 text-xs text-primary">
                        Editing existing entries for: <strong>{employeeOptionText(previewEmployee)}</strong>
                      </p>
                    ) : null}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={applyFirstDayScheduleToAll}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy schedule to all
                  </Button>
                </div>
                <div className="overflow-x-auto overflow-y-visible rounded-md">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-muted/40">
                      <tr className="border-b text-left">
                        <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground">Día</th>
                        <th className="h-10 w-[96px] px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground">Entrada</th>
                        <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground">Lunch</th>
                        <th className="h-10 w-[96px] px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground">Salida</th>
                        <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap text-muted-foreground">Horas</th>
                        <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap text-muted-foreground">Pay</th>
                        <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-muted-foreground">Dirección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingExistingEntries ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <tr key={`loading-row-${index}`} className="border-b last:border-0">
                            <td className="p-2"><Skeleton className="h-8 w-[140px]" /></td>
                            <td className="p-2"><Skeleton className="h-8 w-[88px]" /></td>
                            <td className="p-2"><Skeleton className="h-8 w-[90px]" /></td>
                            <td className="p-2"><Skeleton className="h-8 w-[88px]" /></td>
                            <td className="p-2"><Skeleton className="ml-auto h-6 w-[48px]" /></td>
                            <td className="p-2"><Skeleton className="ml-auto h-6 w-[72px]" /></td>
                            <td className="p-2"><Skeleton className="h-8 w-[360px]" /></td>
                          </tr>
                        ))
                      ) : (
                        days.map((day, index) => {
                        const isWorkedShift =
                          day.day_type === 'worked_day' &&
                          day.day_state === 'working';
                        const isUnpaidAbsence = day.day_type === 'unpaid_leave';
                        const isUnpaidDayOff =
                          day.day_type === 'day_off' &&
                          !Boolean(previewEmployee?.off_days_paid);
                        const paidDayDefault = Number(
                          previewEmployee?.paid_day_hours ?? 8,
                        );
                        const rowDisplayHours = getPayrollHoursForDayDraft(day, {
                          defaultPaidHours: paidDayDefault,
                          offDaysPaid: Boolean(previewEmployee?.off_days_paid),
                        });
                        const dayIssues = rowIssues[day.row_id] ?? [];
                        const dayHasTimeIssue = dayIssues.some((issue) =>
                          issue === 'Missing start or end time' ||
                          issue === 'End time must be after start' ||
                          issue === 'Overlapping shift',
                        );
                        const duplicateCount = existingDuplicateByDate.get(day.date);
                        const split = isWorkedShift
                          ? previewBreakdownByDate[day.row_id] ?? {
                              regular: Number(rowDisplayHours.toFixed(2)),
                              overtime: 0,
                            }
                          : {
                              regular: Number(rowDisplayHours.toFixed(2)),
                              overtime: 0,
                            };
                        const strikeTimeCells = !isWorkedShift;
                        const strikeHoursPayCells =
                          isUnpaidAbsence || isUnpaidDayOff;
                        const addressDayNote = absentDayAddressNoteEs(day.day_type);
                        const weekendType = getWeekendType(day.date);
                        const existingRow = existingRowsById[day.row_id];
                        const isExistingRow = Boolean(existingRow);
                        const isModifiedExistingRow = Boolean(existingRow) && modifiedExistingRowsById[day.row_id] === true;
                        const isPaidRow = Boolean(day.paid_day_locked);
                        return (
                          <tr
                            key={`${day.row_id}-${index}`}
                            className={`group border-b align-middle last:border-0 ${
                              isPaidRow
                                ? 'bg-muted/50 opacity-95'
                                : ''
                            } ${
                              weekendType === 'saturday'
                                ? 'bg-sky-50/70 dark:bg-sky-950/25'
                                : weekendType === 'sunday'
                                  ? 'bg-rose-50/70 dark:bg-rose-950/25'
                                  : ''
                            } ${
                              isModifiedExistingRow
                                ? 'ring-1 ring-amber-300/70 dark:ring-amber-800/70'
                                : isExistingRow
                                  ? 'bg-emerald-50/45 dark:bg-emerald-950/20'
                                  : ''
                            }`}
                          >
                            <td className="p-2 whitespace-nowrap align-middle">
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-fit max-w-full cursor-help rounded-md border-b border-dotted border-muted-foreground/35 bg-transparent px-0 py-0 text-left font-medium text-foreground leading-tight hover:border-muted-foreground/60"
                                  >
                                    {enWeekdayShort(day.date)} {day.date}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  sideOffset={10}
                                  className="max-w-[min(260px,calc(100vw-2rem))] rounded-2xl border-0 bg-zinc-950 px-3 py-2.5 text-xs font-normal leading-snug text-white shadow-xl [&>svg]:hidden"
                                >
                                  {dayTypeTooltipText(day.day_type)}
                                </TooltipContent>
                              </Tooltip>
                              {isPaidRow ? (
                                <Badge
                                  variant="secondary"
                                  className="mt-1 hidden text-[10px] font-normal group-hover:inline-flex"
                                >
                                  Día ya pagado
                                </Badge>
                              ) : null}
                              {isExistingRow ? (
                                <div className="mt-0.5 inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Existing
                                </div>
                              ) : null}
                              {isModifiedExistingRow ? (
                                <div className="mt-0.5 ml-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                  Modified
                                </div>
                              ) : null}
                              {duplicateCount && duplicateCount > 1 ? (
                                <div className="mt-0.5 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                  {duplicateCount} shifts existing
                                </div>
                              ) : null}
                            </td>
                            <td
                              className={cn(
                                'p-2 align-middle',
                                strikeTimeCells &&
                                  'line-through decoration-foreground/50 opacity-[0.72]',
                              )}
                            >
                              <Input
                                type="time"
                                className={`h-9 w-[88px] appearance-none px-2 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden ${
                                  dayHasTimeIssue ? 'border-destructive/60 focus-visible:ring-destructive/30' : ''
                                }`}
                                disabled={isPaidRow || day.day_type !== 'worked_day'}
                                value={day.start_time}
                                onChange={(e) =>
                                  updateDay(day.row_id, (currentDay) => ({
                                    ...currentDay,
                                    start_time: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td
                              className={cn(
                                'p-2 align-middle',
                                strikeTimeCells &&
                                  'line-through decoration-foreground/50 opacity-[0.72]',
                              )}
                            >
                              <select
                                className="flex h-9 w-[90px] rounded-md border bg-background px-2"
                                disabled={isPaidRow || day.day_type !== 'worked_day'}
                                value={String(day.break_minutes)}
                                onChange={(e) =>
                                  updateDay(day.row_id, (currentDay) => ({
                                    ...currentDay,
                                    break_minutes: Number(e.target.value),
                                  }))
                                }
                              >
                                <option value="0">0</option>
                                <option value="15">15</option>
                                <option value="30">30</option>
                                <option value="45">45</option>
                                <option value="60">60</option>
                              </select>
                            </td>
                            <td
                              className={cn(
                                'p-2 align-middle',
                                strikeTimeCells &&
                                  'line-through decoration-foreground/50 opacity-[0.72]',
                              )}
                            >
                              <Input
                                type="time"
                                className={`h-9 w-[88px] appearance-none px-2 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden ${
                                  dayHasTimeIssue ? 'border-destructive/60 focus-visible:ring-destructive/30' : ''
                                }`}
                                disabled={isPaidRow || day.day_type !== 'worked_day'}
                                value={day.end_time}
                                onChange={(e) =>
                                  updateDay(day.row_id, (currentDay) => ({
                                    ...currentDay,
                                    end_time: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td
                              className={cn(
                                'p-2 text-right font-semibold tabular-nums align-middle',
                                strikeHoursPayCells &&
                                  'line-through decoration-foreground/50 opacity-[0.72]',
                              )}
                            >
                              {rowDisplayHours.toFixed(2)}
                            </td>
                            <td
                              className={cn(
                                'p-2 text-right font-medium tabular-nums align-middle',
                                strikeHoursPayCells &&
                                  'line-through decoration-foreground/50 opacity-[0.72]',
                              )}
                            >
                              {previewEmployee
                                ? formatMoney(
                                    split.regular * getRateForPerson(previewEmployee) +
                                      split.overtime *
                                        getRateForPerson(previewEmployee) *
                                        Number(previewEmployee.overtime_rate_multiplier ?? 1.5),
                                  )
                                : '—'}
                            </td>
                            <td className="p-2 align-middle">
                              <div className="relative w-[420px] pr-10">
                                {addressDayNote ? (
                                  <p className="mb-1.5 rounded-md border border-border/70 bg-muted/45 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                                    {addressDayNote}
                                  </p>
                                ) : null}
                                <Input
                                  className="h-9 w-full"
                                  placeholder="Address"
                                  disabled={isPaidRow}
                                  value={day.address ?? ''}
                                  onFocus={() => setActiveAddressRowId(day.row_id)}
                                  onClick={() => setActiveAddressRowId(day.row_id)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveAddressRowId((current) =>
                                        current === day.row_id ? null : current,
                                      );
                                    }, 160);
                                  }}
                                  onChange={(e) =>
                                    updateDay(day.row_id, (currentDay) => ({
                                      ...currentDay,
                                      address: e.target.value,
                                      notes: currentDay.notes ?? '',
                                    }))
                                  }
                                />
                                {activeAddressRowId === day.row_id ? (
                                  <div className="absolute top-[calc(100%+6px)] z-40 max-h-64 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-md">
                                    <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Projectos existentes
                                    </div>
                                    {filteredProjectAddressOptions.length > 0 ? (
                                      filteredProjectAddressOptions.map((option) => (
                                        <button
                                          key={`project-address-${option.projectId}`}
                                          type="button"
                                          className="mb-1 block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            updateDay(day.row_id, (currentDay) => ({
                                              ...currentDay,
                                              project_id: option.projectId,
                                              address: option.address,
                                              notes: currentDay.notes ?? '',
                                            }));
                                            setActiveAddressRowId(null);
                                          }}
                                        >
                                          {option.label}
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-2 py-1 text-xs text-muted-foreground">
                                        No matching project addresses.
                                      </div>
                                    )}
                                    <div className="my-2 border-t" />
                                    <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Sugerencia de direcciones de Google
                                    </div>
                                    {isLoadingGoogleSuggestions ? (
                                      <div className="px-2 py-1 text-xs text-muted-foreground">
                                        Loading suggestions...
                                      </div>
                                    ) : googleAddressSuggestions.length > 0 ? (
                                      googleAddressSuggestions.map((option) => (
                                        <button
                                          key={`google-address-${option.placeId}`}
                                          type="button"
                                          className="mb-1 block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            updateDay(day.row_id, (currentDay) => ({
                                              ...currentDay,
                                              address: option.text,
                                              notes: currentDay.notes ?? '',
                                            }));
                                            setActiveAddressRowId(null);
                                          }}
                                        >
                                          {option.text}
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-2 py-1 text-xs text-muted-foreground">
                                        Type at least 3 characters to search.
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                                <div className="absolute inset-y-0 right-1 flex items-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      disabled={isPaidRow}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => duplicateShiftRow(day.row_id)}>
                                        Duplicar turno
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'worked_day')}>
                                        Convertir a Worked Day
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'holiday')}>
                                        Convertir a Holiday
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'sick_day')}>
                                        Convertir a Sick Day
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'vacation_day')}>
                                        Convertir a Vacation
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'day_off')}>
                                        Convertir a Day Off
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => convertRowDayType(day.row_id, 'unpaid_leave')}>
                                        Convertir a Unpaid
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => deleteShiftRow(day.row_id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t bg-background px-4 py-3 md:px-6">
            <div className="relative grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              {warnings.length > 0 ? (
                <div className="pointer-events-none absolute -top-4 left-0 rounded bg-background px-2 text-xs text-destructive">
                  {warnings[0]}
                </div>
              ) : null}
              <div className="min-w-0 flex-1 text-sm tracking-tight">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <select
                    className="h-9 max-w-[280px] rounded-md border bg-background px-3 text-sm"
                    value={previewEmployeeId ?? ''}
                    onChange={(event) =>
                      setPreviewEmployeeId(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    disabled={selectedEmployees.length === 0}
                  >
                    <option value="">Preview employee</option>
                    {selectedEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeOptionText(employee)}
                      </option>
                    ))}
                  </select>
                  {previewEmployee ? (
                    <span className="text-muted-foreground">
                      Rate: <strong>{formatMoney(getRateForPerson(previewEmployee))}/hr</strong>
                    </span>
                  ) : null}
                  <strong>TOTAL</strong>
                  <span>Horas: <strong>{footerTotals.total.toFixed(2)}</strong></span>
                  <span>Regular: <strong>{footerTotals.regular.toFixed(2)}</strong></span>
                  <span>OT: <strong>{footerTotals.overtime.toFixed(2)}</strong></span>
                  <span>Pay: <strong>{formatMoney(footerTotals.pay)}</strong></span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSave('draft')}
                  disabled={isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Draft
                </Button>
                <Button type="button" onClick={() => handleSave('submitted')} disabled={isSaving}>
                  <Send className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
