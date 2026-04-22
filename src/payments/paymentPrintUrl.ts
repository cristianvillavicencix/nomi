import type { Payment } from "@/components/atomic-crm/types";
import type { PaymentLinesScope } from "./PaymentLinesTable";

/** Opens the payment show view in print layout (same tab uses hash router in some setups). */
export const buildPaymentPrintUrl = ({
  paymentId,
  scope,
  personId,
}: {
  paymentId: Payment["id"];
  scope: PaymentLinesScope;
  personId?: number | null;
}) => {
  const params = new URLSearchParams({ print: "1", scope });
  if (personId != null) params.set("person_id", String(personId));
  return `${window.location.origin}${window.location.pathname}#/payments/${paymentId}/show?${params.toString()}`;
};
