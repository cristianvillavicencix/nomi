import { useDataProvider, useNotify, useRecordContext, useRefresh } from 'ra-core';
import { Button } from '@/components/ui/button';
import {
  DateInput,
  Edit,
  FormToolbar,
  NumberInput,
  ReferenceManyField,
  SaveButton,
  SelectInput,
  SimpleForm,
} from '@/components/admin';
import { PaymentLinesTable } from './PaymentLinesTable';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';

const statusChoices = [
  { id: 'draft', name: 'Draft' },
  { id: 'approved', name: 'Approved' },
  { id: 'paid', name: 'Paid' },
];

const GenerateLinesButton = () => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();
  const record = useRecordContext();

  if (!record) return null;

  const onClick = async () => {
    try {
      const created = await dataProvider.generatePaymentLines(record.id);
      notify(`Generated ${created ?? 0} payment lines`);
      refresh();
    } catch {
      notify('Could not generate payment lines', { type: 'error' });
    }
  };

  return (
    <Button type="button" variant="outline" onClick={onClick}>
      Generate Lines
    </Button>
  );
};

const PaymentEditToolbar = () => (
  <FormToolbar>
    <SaveButton />
    <GenerateLinesButton />
  </FormToolbar>
);

export const PaymentsEdit = () => (
  <Edit>
    <SimpleForm toolbar={<PaymentEditToolbar />}>
      <NumberInput source="org_id" />
      <DateInput source="pay_period_start" />
      <DateInput source="pay_period_end" />
      <DateInput source="pay_date" />
      <SelectInput source="status" choices={statusChoices} />
      <NumberInput source="total_gross" />
      <NumberInput source="total_net" />

      <ReferenceManyField reference="payment_lines" target="payment_id">
        <PaymentLinesTable />
      </ReferenceManyField>
    </SimpleForm>
  </Edit>
);
