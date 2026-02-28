import { useEffect, useMemo, useState } from 'react';
import { useDataProvider, useGetList, useNotify, useRefresh } from 'ra-core';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';
import type { Person } from '@/components/atomic-crm/types';
import { formatMoney } from '@/people/constants';
import {
  buildTimeEntryPayloads,
  calculateHours,
  chunkCreateTimeEntries,
  createDefaultDayDrafts,
  employeeOptionText,
  getDailyBreakdown,
  getRateForPerson,
  type DayDraft,
  type DayState,
} from './helpers';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RangeMode = 'day' | 'week';

const lunchOptions = [0, 15, 30, 45, 60];
const dayStateOptions: Array<{ value: DayState; label: string }> = [
  { value: 'working', label: 'Working' },
  { value: 'day_off', label: 'Day off' },
  { value: 'holiday', label: 'Holiday' },
];

export const TimeEntriesBulkCreateModal = ({ open, onOpenChange }: Props) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState('');
  const [weekAddress, setWeekAddress] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [days, setDays] = useState<DayDraft[]>(createDefaultDayDrafts(startDate, endDate));
  const [isSaving, setIsSaving] = useState(false);

  const { data: employees = [] } = useGetList<Person>('people', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'first_name', order: 'ASC' },
    filter: { type: 'employee', status: 'active' },
  });
  const { data: projects = [] } = useGetList<{ id: number; name: string }>('deals', {
    pagination: { page: 1, perPage: 200 },
    sort: { field: 'name', order: 'ASC' },
    filter: { 'archived_at@is': null },
  });

  useEffect(() => {
    const normalizedEndDate =
      rangeMode === 'day'
        ? startDate
        : new Date(new Date(`${startDate}T00:00:00`).getTime() + 6 * 86400000)
            .toISOString()
            .slice(0, 10);
    setEndDate(normalizedEndDate);
  }, [rangeMode, startDate]);

  useEffect(() => {
    setDays((previousDays) => {
      const nextDays = createDefaultDayDrafts(startDate, endDate);
      return nextDays.map((nextDay) => {
        const previous = previousDays.find((item) => item.date === nextDay.date);
        if (!previous) {
          return { ...nextDay, address: weekAddress };
        }
        return {
          ...previous,
          address: previous.address || weekAddress,
        };
      });
    });
  }, [startDate, endDate, weekAddress]);

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedEmployeeIds.includes(employee.id)),
    [employees, selectedEmployeeIds],
  );

  const totals = useMemo(() => {
    const employeeCount = selectedEmployees.length || 1;
    const aggregate = days.reduce(
      (acc, day) => {
        const breakdown = getDailyBreakdown(day);
        acc.total += breakdown.total;
        acc.regular += breakdown.regular;
        acc.overtime += breakdown.overtime;
        acc.holiday += breakdown.holiday;
        return acc;
      },
      { total: 0, regular: 0, overtime: 0, holiday: 0 },
    );

    const pay = selectedEmployees.reduce((sum, employee) => {
      const rate = getRateForPerson(employee);
      return sum + aggregate.regular * rate + aggregate.overtime * rate + aggregate.holiday * rate;
    }, 0);

    const avgRate =
      selectedEmployees.length > 0
        ? selectedEmployees.reduce((sum, employee) => sum + getRateForPerson(employee), 0) /
          selectedEmployees.length
        : 0;

    return {
      total: Number((aggregate.total * employeeCount).toFixed(2)),
      regular: Number((aggregate.regular * employeeCount).toFixed(2)),
      overtime: Number((aggregate.overtime * employeeCount).toFixed(2)),
      holiday: Number((aggregate.holiday * employeeCount).toFixed(2)),
      rate: avgRate,
      pay: Number(pay.toFixed(2)),
    };
  }, [days, selectedEmployees]);

  const toggleEmployee = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds((current) =>
      checked ? [...current, employeeId] : current.filter((id) => id !== employeeId),
    );
  };

  const updateDay = (date: string, updater: (day: DayDraft) => DayDraft) => {
    setDays((current) => current.map((day) => (day.date === date ? updater(day) : day)));
  };

  const addShift = (date: string) => {
    updateDay(date, (day) => ({
      ...day,
      shifts: [...day.shifts, { start_time: '', end_time: '', lunch_minutes: 0 }],
    }));
  };

  const validateDays = () => {
    for (const day of days) {
      if (day.day_state === 'day_off') continue;
      for (const shift of day.shifts) {
        const hasPartialTime = Boolean(shift.start_time) !== Boolean(shift.end_time);
        if (hasPartialTime) {
          notify(`Incomplete time range on ${day.date}`, { type: 'error' });
          return false;
        }
        if (shift.start_time && shift.end_time && calculateHours(shift.start_time, shift.end_time, shift.lunch_minutes) <= 0) {
          notify(`End time must be after start time on ${day.date}`, { type: 'error' });
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!selectedEmployees.length) {
      notify('Select at least one employee', { type: 'error' });
      return;
    }
    if (!projectId) {
      notify('Project is required', { type: 'error' });
      return;
    }
    if (!validateDays()) {
      return;
    }

    const payloads = buildTimeEntryPayloads({
      days,
      employees: selectedEmployees,
      projectId: Number(projectId),
      status: 'draft',
    });

    if (!payloads.length) {
      notify('No time entries to create', { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await chunkCreateTimeEntries(dataProvider, payloads);
      notify(`${payloads.length} time entries created`);
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo registro</DialogTitle>
          <DialogDescription>
            Create one-day or weekly time entries for one or more employees.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employees</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-72 overflow-y-auto">
                {employees.map((employee) => (
                  <label key={employee.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onCheckedChange={(checked) => toggleEmployee(employee.id, checked === true)}
                    />
                    <span>{employeeOptionText(employee)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Range</Label>
              <div className="flex gap-2">
                <Button type="button" variant={rangeMode === 'day' ? 'default' : 'outline'} onClick={() => setRangeMode('day')}>
                  Day
                </Button>
                <Button type="button" variant={rangeMode === 'week' ? 'default' : 'outline'} onClick={() => setRangeMode('week')}>
                  Full Week
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select
                id="projectId"
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekAddress">Direction (week)</Label>
              <Input id="weekAddress" value={weekAddress} onChange={(e) => setWeekAddress(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Lunch</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Shift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((day) => (
                  day.shifts.map((shift, shiftIndex) => {
                    const hours =
                      day.day_state === 'day_off'
                        ? 0
                        : calculateHours(shift.start_time, shift.end_time, shift.lunch_minutes);
                    return (
                      <TableRow key={`${day.date}-${shiftIndex}`}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell>
                          {shiftIndex === 0 ? (
                            <select
                              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                              value={day.day_state}
                              onChange={(e) =>
                                updateDay(day.date, (currentDay) => ({
                                  ...currentDay,
                                  day_state: e.target.value as DayState,
                                  shifts:
                                    e.target.value === 'day_off'
                                      ? currentDay.shifts.map((currentShift) => ({
                                          ...currentShift,
                                          start_time: '',
                                          end_time: '',
                                        }))
                                      : currentDay.shifts,
                                }))
                              }
                            >
                              {dayStateOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={shift.start_time}
                            disabled={day.day_state === 'day_off'}
                            onChange={(e) =>
                              updateDay(day.date, (currentDay) => ({
                                ...currentDay,
                                shifts: currentDay.shifts.map((currentShift, currentIndex) =>
                                  currentIndex === shiftIndex
                                    ? { ...currentShift, start_time: e.target.value }
                                    : currentShift,
                                ),
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="time"
                            value={shift.end_time}
                            disabled={day.day_state === 'day_off'}
                            onChange={(e) =>
                              updateDay(day.date, (currentDay) => ({
                                ...currentDay,
                                shifts: currentDay.shifts.map((currentShift, currentIndex) =>
                                  currentIndex === shiftIndex
                                    ? { ...currentShift, end_time: e.target.value }
                                    : currentShift,
                                ),
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                            value={shift.lunch_minutes}
                            disabled={day.day_state === 'day_off'}
                            onChange={(e) =>
                              updateDay(day.date, (currentDay) => ({
                                ...currentDay,
                                shifts: currentDay.shifts.map((currentShift, currentIndex) =>
                                  currentIndex === shiftIndex
                                    ? {
                                        ...currentShift,
                                        lunch_minutes: Number(e.target.value),
                                      }
                                    : currentShift,
                                ),
                              }))
                            }
                          >
                            {lunchOptions.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                {minutes}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>{hours.toFixed(2)}</TableCell>
                        <TableCell>
                          {shiftIndex === 0 ? (
                            <Input
                              value={day.address}
                              onChange={(e) =>
                                updateDay(day.date, (currentDay) => ({
                                  ...currentDay,
                                  address: e.target.value,
                                }))
                              }
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{shiftIndex + 1}</span>
                            {shiftIndex === 0 ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => addShift(day.date)}>
                                + Turno
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 rounded-md border p-4 text-sm">
              <div>
                <div className="text-muted-foreground">Hours</div>
                <div className="font-medium">{totals.total.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Regular</div>
                <div className="font-medium">{totals.regular.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">OT</div>
                <div className="font-medium">{totals.overtime.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Holiday</div>
                <div className="font-medium">{totals.holiday.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Rate</div>
                <div className="font-medium">{formatMoney(totals.rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pay</div>
                <div className="font-medium">{formatMoney(totals.pay)}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
