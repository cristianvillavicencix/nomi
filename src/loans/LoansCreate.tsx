import { Create, SimpleForm } from '@/components/admin';
import { normalizeLoanPayload } from './helpers';
import { LoansForm } from './LoansForm';
import { LoansToolbar } from './LoansToolbar';

export const LoansCreate = () => (
  <Create redirect="list">
    <SimpleForm
      className="w-full max-w-none"
      transform={normalizeLoanPayload}
      toolbar={<LoansToolbar transform={normalizeLoanPayload} showPrint={false} />}
      defaultValues={{
        loan_date: new Date().toISOString().slice(0, 10),
        record_type: 'loan',
        repayment_strategy: 'count',
        active: true,
        paused: false,
        start_next_payroll: true,
        repayment_schedule: 'next_payroll',
        payment_count: 4,
        deduction_mode: 'fixed_installment',
      }}
    >
      <LoansForm />
    </SimpleForm>
  </Create>
);
