import { PaymentsCreateWizard } from './PaymentsCreateWizard';
import { PaymentsEdit } from './PaymentsEdit';
import { PaymentsList } from './PaymentsList';
import { PaymentsShow } from './PaymentsShow';

export default {
  list: PaymentsList,
  create: PaymentsCreateWizard,
  edit: PaymentsEdit,
  show: PaymentsShow,
  options: {
    label: 'Payments',
  },
};
