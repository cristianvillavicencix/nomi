import { useState } from 'react';
import { useDataProvider, useNotify, useRecordContext, useRefresh } from 'ra-core';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DateInput,
  Edit,
  FormToolbar,
  NumberInput,
  ReferenceManyField,
  SaveButton,
  SelectInput,
  SimpleForm,
  TextInput,
} from '@/components/admin';
import { PaymentLinesTable, type PaymentLinesScope } from './PaymentLinesTable';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';

const statusChoices = [
  { id: 'draft', name: 'Draft' },
  { id: 'approved', name: 'Approved' },
  { id: 'paid', name: 'Paid' },
];

const paymentScopeTabs: Array<{ value: PaymentLinesScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sales_commissions', label: 'Sales Commissions' },
  { value: 'hourly', label: 'Hourly Staff' },
  { value: 'salaried', label: 'Salaried Staff' },
  { value: 'subcontractor', label: 'Subcontractors' },
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

export const PaymentsEdit = () => {
  const [scope, setScope] = useState<PaymentLinesScope>('all');

  return (
    <Edit>
      <SimpleForm toolbar={<PaymentEditToolbar />}>
        <NumberInput source="org_id" />
        <TextInput source="run_name" />
        <TextInput source="created_by" />
        <TextInput source="notes" multiline />
        <SelectInput
          source="category"
          choices={[
            { id: 'hourly', name: 'Hourly Staff' },
            { id: 'salaried', name: 'Salaried Staff' },
            { id: 'subcontractor', name: 'Subcontractors' },
            { id: 'sales_commissions', name: 'Sales Commissions' },
            { id: 'mixed', name: 'Mixed' },
          ]}
        />
        <NumberInput source="total_gross" />
        <NumberInput source="total_net" />
        <DateInput source="approved_at" />
        <DateInput source="paid_at" />
        <DateInput source="pay_period_start" />
        <DateInput source="pay_period_end" />
        <DateInput source="pay_date" />
        <SelectInput source="status" choices={statusChoices} />

        <div className="space-y-3">
          <Tabs value={scope} onValueChange={(value) => setScope(value as PaymentLinesScope)}>
            <TabsList>
              {paymentScopeTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <ReferenceManyField reference="payment_lines" target="payment_id">
            <PaymentLinesTable scope={scope} />
          </ReferenceManyField>
        </div>
      </SimpleForm>
    </Edit>
  );
};
