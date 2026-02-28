import { CreateButton, DataTable, List, NumberField } from '@/components/admin';
import { TopToolbar } from '@/components/atomic-crm/layout/TopToolbar';

const PaymentsListActions = () => (
  <TopToolbar>
    <CreateButton label="New Payment" />
  </TopToolbar>
);

export const PaymentsList = () => (
  <List title="Payments" sort={{ field: 'pay_date', order: 'DESC' }} actions={<PaymentsListActions />}>
    <DataTable rowClick="show">
      <DataTable.Col source="pay_period_start" />
      <DataTable.Col source="pay_period_end" />
      <DataTable.Col source="pay_date" />
      <DataTable.Col source="status" />
      <DataTable.Col source="total_gross">
        <NumberField source="total_gross" options={{ style: 'currency', currency: 'USD' }} />
      </DataTable.Col>
      <DataTable.Col source="total_net">
        <NumberField source="total_net" options={{ style: 'currency', currency: 'USD' }} />
      </DataTable.Col>
    </DataTable>
  </List>
);
