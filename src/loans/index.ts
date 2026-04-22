import { LoansCreate } from './LoansCreate';
import { LoansEdit } from './LoansEdit';
import { LoansList } from './LoansList';
import { LoansShow } from './LoansShow';

export default {
  list: LoansList,
  create: LoansCreate,
  edit: LoansEdit,
  show: LoansShow,
  options: {
    label: 'Loans',
  },
};
