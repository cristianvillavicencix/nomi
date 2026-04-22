import { Edit, SimpleForm } from '@/components/admin';
import { normalizeLoanPayload } from './helpers';
import { LoansForm } from './LoansForm';
import { LoansToolbar } from './LoansToolbar';

export const LoansEdit = () => (
  <Edit>
    <SimpleForm
      className="w-full max-w-none"
      transform={normalizeLoanPayload}
      toolbar={<LoansToolbar transform={normalizeLoanPayload} showPrint={false} />}
    >
      <LoansForm />
    </SimpleForm>
  </Edit>
);
