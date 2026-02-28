import { NumberField, ReferenceManyField, Show, SimpleShowLayout, TextField } from '@/components/admin';
import { PaymentLinesTable } from './PaymentLinesTable';

export const PaymentsShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="pay_period_start" />
      <TextField source="pay_period_end" />
      <TextField source="pay_date" />
      <TextField source="status" />
      <NumberField source="total_gross" options={{ style: 'currency', currency: 'USD' }} />
      <NumberField source="total_net" options={{ style: 'currency', currency: 'USD' }} />

      <ReferenceManyField reference="payment_lines" target="payment_id">
        <PaymentLinesTable />
      </ReferenceManyField>
    </SimpleShowLayout>
  </Show>
);
