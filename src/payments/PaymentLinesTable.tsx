import { DataTable, NumberField, ReferenceField, TextField } from '@/components/admin';

export const PaymentLinesTable = () => (
  <DataTable rowClick={false} bulkActionButtons={false}>
    <DataTable.Col source="source_type" />
    <DataTable.Col label="Person">
      <ReferenceField source="person_id" reference="people" link={false}>
        <TextField source="last_name" />
      </ReferenceField>
    </DataTable.Col>
    <DataTable.Col label="Project">
      <ReferenceField source="project_id" reference="deals" link="show" emptyText="-">
        <TextField source="name" />
      </ReferenceField>
    </DataTable.Col>
    <DataTable.Col source="qty_hours" />
    <DataTable.Col source="rate">
      <NumberField source="rate" options={{ style: 'currency', currency: 'USD' }} />
    </DataTable.Col>
    <DataTable.Col source="amount">
      <NumberField source="amount" options={{ style: 'currency', currency: 'USD' }} />
    </DataTable.Col>
    <DataTable.Col source="notes" />
  </DataTable>
);
