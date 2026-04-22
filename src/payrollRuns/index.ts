import { PayrollRunsCreate } from './PayrollRunsCreate';
import { PayrollRunsEdit } from './PayrollRunsEdit';
import { PayrollRunsList } from './PayrollRunsList';
import { PayrollRunsShow } from './PayrollRunsShow';

export default {
  list: PayrollRunsList,
  create: PayrollRunsCreate,
  edit: PayrollRunsEdit,
  show: PayrollRunsShow,
  options: {
    label: 'Payroll',
  },
};
