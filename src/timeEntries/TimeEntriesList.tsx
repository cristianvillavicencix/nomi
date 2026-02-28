import { useMemo, useState } from 'react';
import {
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdateMany,
} from 'ra-core';
import { CheckCheck } from 'lucide-react';
import {
  AutocompleteInput,
  CreateButton,
  DataTable,
  ExportButton,
  FilterButton,
  List,
  ReferenceField,
  ReferenceInput,
  SelectInput,
  TextField,
  DateInput,
} from '@/components/admin';
import { TopToolbar } from '@/components/atomic-crm/layout/TopToolbar';
import { Button } from '@/components/ui/button';
import type { Person, TimeEntry } from '@/components/atomic-crm/types';
import { TimeEntriesBulkCreateModal } from './TimeEntriesBulkCreateModal';
import { employeeOptionText, parseTimeEntryMeta } from './helpers';

const statusChoices = [
  { id: 'draft', name: 'Draft' },
  { id: 'approved', name: 'Approved' },
  { id: 'paid', name: 'Paid' },
];

const filters = [
  <DateInput key="date_gte" source="date@gte" label="From" />,
  <DateInput key="date_lte" source="date@lte" label="To" />,
  <ReferenceInput key="project" source="project_id" reference="deals">
    <AutocompleteInput label="Project" optionText="name" />
  </ReferenceInput>,
  <ReferenceInput key="person" source="person_id" reference="people" filter={{ type: 'employee' }}>
    <AutocompleteInput label="Employee" optionText={employeeOptionText} />
  </ReferenceInput>,
  <SelectInput key="status" source="status" choices={statusChoices} />,
];

const TimeEntriesListActions = () => {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  return (
    <>
      <TopToolbar>
        <FilterButton />
        <ExportButton />
        <CreateButton label="Quick Add" />
        <Button type="button" onClick={() => setBulkModalOpen(true)}>
          Nuevo registro
        </Button>
      </TopToolbar>
      <TimeEntriesBulkCreateModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
      />
    </>
  );
};

const BulkApproveButton = () => {
  const { selectedIds, data, onUnselectItems } = useListContext<TimeEntry>();
  const [updateMany, { isPending }] = useUpdateMany();
  const notify = useNotify();
  const refresh = useRefresh();

  const draftIds = useMemo(
    () =>
      (selectedIds ?? []).filter((id) =>
        data?.some((entry) => entry.id === id && entry.status === 'draft'),
      ),
    [data, selectedIds],
  );

  const handleApprove = () => {
    if (!draftIds.length) {
      notify('Only draft entries can be approved', { type: 'error' });
      return;
    }

    updateMany(
      'time_entries',
      {
        ids: draftIds,
        data: { status: 'approved' },
      },
      {
        onSuccess: () => {
          const skipped = (selectedIds?.length ?? 0) - draftIds.length;
          notify(
            skipped > 0
              ? `Approved ${draftIds.length} draft entries. ${skipped} skipped.`
              : 'Time entries approved',
          );
          onUnselectItems?.();
          refresh();
        },
        onError: () => {
          notify('Could not approve time entries', { type: 'error' });
        },
      },
    );
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleApprove}
      disabled={!selectedIds?.length || isPending}
    >
      <CheckCheck className="h-4 w-4 mr-2" />
      Approve selected
    </Button>
  );
};

const PersonName = () => {
  const person = useRecordContext<Person>();
  if (!person) return null;
  return <span>{employeeOptionText(person)}</span>;
};

const DayStateField = () => {
  const entry = useRecordContext<TimeEntry>();
  if (!entry) return null;
  return <span>{parseTimeEntryMeta(entry.notes).day_state ?? 'working'}</span>;
};

const AddressField = () => {
  const entry = useRecordContext<TimeEntry>();
  if (!entry) return null;
  return <span>{parseTimeEntryMeta(entry.notes).address ?? '-'}</span>;
};

export const TimeEntriesList = () => (
  <List
    title="Hours"
    sort={{ field: 'date', order: 'DESC' }}
    filters={filters}
    actions={<TimeEntriesListActions />}
  >
    <DataTable rowClick="edit" bulkActionButtons={<BulkApproveButton />}>
      <DataTable.Col source="date" />
      <DataTable.Col label="Employee">
        <ReferenceField source="person_id" reference="people" link={false}>
          <PersonName />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Project">
        <ReferenceField source="project_id" reference="deals" link="show">
          <TextField source="name" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col label="Day State">
        <DayStateField />
      </DataTable.Col>
      <DataTable.Col source="hours" />
      <DataTable.Col source="status" />
      <DataTable.Col label="Address">
        <AddressField />
      </DataTable.Col>
    </DataTable>
  </List>
);
