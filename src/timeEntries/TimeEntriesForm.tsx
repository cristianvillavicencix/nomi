import { useEffect, useMemo } from 'react';
import { required, useGetOne, useRecordContext } from 'ra-core';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  AutocompleteInput,
  DateInput,
  NumberInput,
  ReferenceInput,
  SelectInput,
  TextInput,
} from '@/components/admin';
import { employeeOptionText, calculateHours, parseTimeEntryMeta, stringifyTimeEntryMeta } from './helpers';
import type { DayState } from './helpers';
import type { Person, TimeEntry } from '@/components/atomic-crm/types';

const statusChoices = [
  { id: 'draft', name: 'Draft' },
  { id: 'submitted', name: 'Submitted' },
  { id: 'approved', name: 'Approved' },
  { id: 'rejected', name: 'Rejected' },
  { id: 'included_in_payroll', name: 'Included In Payroll' },
  { id: 'paid', name: 'Paid' },
];

const dayTypeChoices = [
  { id: 'worked_day', name: 'Worked Day' },
  { id: 'holiday', name: 'Holiday' },
  { id: 'sick_day', name: 'Sick Day' },
  { id: 'vacation_day', name: 'Vacation Day' },
  { id: 'day_off', name: 'Day Off' },
  { id: 'unpaid_leave', name: 'Unpaid Leave' },
];

const dayStateChoices = [
  { id: 'working', name: 'Working' },
  { id: 'day_off', name: 'Day off' },
  { id: 'holiday', name: 'Holiday' },
];

const lunchChoices = [0, 15, 30, 45, 60].map((minutes) => ({
  id: minutes,
  name: `${minutes} min`,
}));

export const TimeEntriesForm = () => {
  const record = useRecordContext<TimeEntry>();
  const paidLocked = record?.status === 'paid';
  const { setValue } = useFormContext();
  const startTime = useWatch({ name: 'start_time' }) as string | undefined;
  const endTime = useWatch({ name: 'end_time' }) as string | undefined;
  const notes = useWatch({ name: 'notes' }) as string | undefined;
  const dayState = useWatch({ name: 'day_state' }) as DayState | undefined;
  const dayType = useWatch({ name: 'day_type' }) as string | undefined;
  const lunchMinutes = useWatch({ name: 'lunch_minutes' }) as number | undefined;
  const personId = useWatch({ name: 'person_id' });

  const { data: person } = useGetOne<Person>(
    'people',
    { id: personId },
    { enabled: Boolean(personId) },
  );

  const existingMeta = useMemo(() => parseTimeEntryMeta(notes), [notes]);
  const effectiveDayState = dayState ?? existingMeta.day_state ?? 'working';
  const effectiveLunchMinutes = Number(
    lunchMinutes ?? existingMeta.lunch_minutes ?? 0,
  );
  const paidDayHours = Number(person?.paid_day_hours ?? 8);
  const offDaysPaid = Boolean(person?.off_days_paid);
  const currentDayType = dayType ?? 'worked_day';
  const paidAbsenceDayHours =
    currentDayType === 'unpaid_leave'
      ? 0
      : currentDayType === 'day_off' && !offDaysPaid
        ? 0
        : paidDayHours;

  useEffect(() => {
    if (paidLocked) return;
    const isPresenceOnlyDay =
      currentDayType === 'holiday' ||
      currentDayType === 'sick_day' ||
      currentDayType === 'vacation_day' ||
      currentDayType === 'day_off' ||
      currentDayType === 'unpaid_leave';

    if (effectiveDayState === 'day_off' || isPresenceOnlyDay) {
      setValue('hours', 0);
      setValue('start_time', '');
      setValue('end_time', '');
      setValue('worked_hours_raw', 0);
      setValue('payable_hours', paidAbsenceDayHours);
      setValue('regular_hours', paidAbsenceDayHours);
      setValue('overtime_hours', 0);
    } else {
      const calculatedHours = calculateHours(startTime, endTime, effectiveLunchMinutes);
      setValue('worked_hours_raw', calculatedHours + effectiveLunchMinutes / 60);
      setValue('payable_hours', calculatedHours);
      setValue('hours', calculatedHours);
      // Overtime is calculated weekly in the daily grid/payroll flow.
      // A single-entry form cannot determine weekly overtime safely.
      setValue('regular_hours', Number(calculatedHours.toFixed(2)));
      setValue('overtime_hours', 0);
    }

      setValue(
      'notes',
      stringifyTimeEntryMeta({
        ...existingMeta,
        day_state: effectiveDayState,
        lunch_minutes: effectiveLunchMinutes,
      }),
    );
  }, [
    effectiveDayState,
    currentDayType,
    effectiveLunchMinutes,
    endTime,
    existingMeta,
    paidDayHours,
    paidAbsenceDayHours,
    setValue,
    startTime,
    paidLocked,
  ]);

  const disabled = Boolean(paidLocked);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberInput source="org_id" defaultValue={1} helperText={false} disabled={disabled} />
      <DateInput source="date" validate={required()} helperText={false} disabled={disabled} />
      <ReferenceInput source="person_id" reference="people" filter={{ type: 'employee' }}>
        <AutocompleteInput
          optionText={employeeOptionText}
          validate={required()}
          helperText={false}
          label="Employee"
          disabled={disabled}
        />
      </ReferenceInput>
      <ReferenceInput source="project_id" reference="deals">
        <AutocompleteInput optionText="name" validate={required()} helperText={false} label="Project" disabled={disabled} />
      </ReferenceInput>
      <SelectInput source="day_type" choices={dayTypeChoices} defaultValue="worked_day" helperText={false} disabled={disabled} />
      <SelectInput
        source="day_state"
        choices={dayStateChoices}
        defaultValue={effectiveDayState}
        helperText={false}
        disabled={disabled}
      />
      <SelectInput
        source="lunch_minutes"
        choices={lunchChoices}
        defaultValue={effectiveLunchMinutes}
        helperText={false}
        disabled={disabled}
      />
      <TextInput source="start_time" helperText={false} disabled={disabled} />
      <TextInput source="end_time" helperText={false} disabled={disabled} />
      <NumberInput source="worked_hours_raw" helperText={false} disabled={disabled} />
      <NumberInput source="payable_hours" helperText={false} disabled={disabled} />
      <NumberInput source="hours" validate={required()} helperText={false} disabled={disabled} />
      <NumberInput source="regular_hours" helperText={false} disabled={disabled} />
      <NumberInput source="overtime_hours" helperText={false} disabled={disabled} />
      <NumberInput source="lunch_minutes" helperText={false} disabled={disabled} />
      <TextInput source="work_location" helperText={false} disabled={disabled} />
      <TextInput source="work_type" helperText={false} disabled={disabled} />
      <SelectInput source="status" choices={statusChoices} defaultValue="draft" helperText={false} disabled={disabled} />
      <TextInput source="notes" multiline rows={3} helperText={false} className="md:col-span-2" disabled={disabled} />
      <TextInput source="internal_notes" multiline rows={3} helperText={false} className="md:col-span-2" disabled={disabled} />
    </div>
  );
};
