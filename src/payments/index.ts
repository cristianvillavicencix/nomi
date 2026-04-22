import { PaymentsCreateWizard } from "./PaymentsCreateWizard";
import { PaymentsList, PaymentsListContent } from "./PaymentsList";
import { PaymentsShow } from "./PaymentsShow";

export { PaymentsListContent };
export type { PaymentsListContentProps } from "./PaymentsList";

export default {
  list: PaymentsList,
  create: PaymentsCreateWizard,
  show: PaymentsShow,
  options: {
    label: "Payments",
  },
};
