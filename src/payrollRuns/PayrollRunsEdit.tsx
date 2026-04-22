import {
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
} from 'ra-core';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateInput,
  Edit,
  FormToolbar,
  SaveButton,
  SelectInput,
  SimpleForm,
  TextInput,
} from '@/components/admin';
import type { CrmDataProvider } from '@/components/atomic-crm/providers/types';
import type { PayrollRun, PayrollRunLine, Person } from '@/components/atomic-crm/types';
import { PayrollRunHeaderBadges } from './payrollRunUi';
import { PayrollRunLinesTableForData } from './PayrollRunLinesTable';

const GenerateLinesButton = () => {
  const record = useRecordContext();
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();

  if (!record) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          const created = await dataProvider.generatePayrollRun(record.id);
          notify(`Payroll refreshed from current hours and loans (${created ?? 0} lines)`);
          refresh();
        } catch {
          notify('Could not refresh payroll from current hours and loans', { type: 'error' });
        }
      }}
    >
      Refresh Payroll
    </Button>
  );
};

const Toolbar = () => (
  <FormToolbar>
    <SaveButton />
    <GenerateLinesButton />
  </FormToolbar>
);

const PayrollRunLinesSection = () => {
  const record = useRecordContext<PayrollRun>();
  const navigate = useNavigate();
  const { data: lines = [], isPending } = useGetList<PayrollRunLine>(
    'payroll_run_lines',
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: 'id', order: 'ASC' },
      filter: { payroll_run_id: record?.id },
    },
    { enabled: Boolean(record?.id) },
  );
  const { data: employee } = useGetOne<Person>(
    'people',
    { id: record?.employee_id ?? '' },
    { enabled: Boolean(record?.employee_id) },
  );

  if (!record) return null;

  return (
    <div className="space-y-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="-ml-3 h-8 px-2"
          onClick={() => navigate('/payroll_runs')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Regresar
        </Button>
      </div>
      <Card className="border-slate-200">
        <CardContent className="space-y-3 p-4">
          <PayrollRunHeaderBadges
            record={record}
            employeeName={
              record.employee_id
                ? employee
                  ? `${employee.first_name} ${employee.last_name}`
                  : `Employee #${record.employee_id}`
                : 'All employees'
            }
          />
        </CardContent>
      </Card>
      <PayrollRunLinesTableForData lines={lines} isPending={isPending} />
    </div>
  );
};

export const PayrollRunsEdit = () => (
  <Edit title={false}>
    <SimpleForm toolbar={<Toolbar />}>
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
      <SelectInput
        source="pay_schedule"
        choices={[
          { id: 'weekly', name: 'Weekly' },
          { id: 'biweekly', name: 'Biweekly' },
          { id: 'semimonthly', name: 'Semi-Monthly' },
          { id: 'monthly', name: 'Monthly' },
        ]}
      />
      <DateInput source="pay_period_start" />
      <DateInput source="pay_period_end" />
      <DateInput source="payday" />
      <TextInput source="created_by" />
      <TextInput source="notes" multiline />

      <PayrollRunLinesSection />
    </SimpleForm>
  </Edit>
);
