import { useEffect, useMemo } from 'react';
import { required } from 'ra-core';
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

const statusChoices = [
  { id: 'draft', name: 'Draft' },
  { id: 'approved', name: 'Approved' },
  { id: 'paid', name: 'Paid' },
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
  const { setValue } = useFormContext();
  const startTime = useWatch({ name: 'start_time' }) as string | undefined;
  const endTime = useWatch({ name: 'end_time' }) as string | undefined;
  const notes = useWatch({ name: 'notes' }) as string | undefined;
  const dayState = useWatch({ name: 'day_state' }) as DayState | undefined;
  const lunchMinutes = useWatch({ name: 'lunch_minutes' }) as number | undefined;

  const existingMeta = useMemo(() => parseTimeEntryMeta(notes), [notes]);
  const effectiveDayState = dayState ?? existingMeta.day_state ?? 'working';
  const effectiveLunchMinutes = Number(
    lunchMinutes ?? existingMeta.lunch_minutes ?? 0,
  );

  useEffect(() => {
    if (effectiveDayState === 'day_off') {
      setValue('hours', 0);
      setValue('start_time', '');
      setValue('end_time', '');
    } else {
      setValue('hours', calculateHours(startTime, endTime, effectiveLunchMinutes));
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
    effectiveLunchMinutes,
    endTime,
    existingMeta,
    setValue,
    startTime,
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberInput source="org_id" defaultValue={1} helperText={false} />
      <DateInput source="date" validate={required()} helperText={false} />
      <ReferenceInput source="person_id" reference="people" filter={{ type: 'employee' }}>
        <AutocompleteInput
          optionText={employeeOptionText}
          validate={required()}
          helperText={false}
          label="Employee"
        />
      </ReferenceInput>
      <ReferenceInput source="project_id" reference="deals">
        <AutocompleteInput optionText="name" validate={required()} helperText={false} label="Project" />
      </ReferenceInput>
      <SelectInput
        source="day_state"
        choices={dayStateChoices}
        defaultValue={effectiveDayState}
        helperText={false}
      />
      <SelectInput
        source="lunch_minutes"
        choices={lunchChoices}
        defaultValue={effectiveLunchMinutes}
        helperText={false}
      />
      <TextInput source="start_time" helperText={false} />
      <TextInput source="end_time" helperText={false} />
      <NumberInput source="hours" validate={required()} helperText={false} />
      <SelectInput source="status" choices={statusChoices} defaultValue="draft" helperText={false} />
      <TextInput source="notes" multiline rows={3} helperText={false} className="md:col-span-2" />
    </div>
  );
};
