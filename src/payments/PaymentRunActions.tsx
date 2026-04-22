import { useState } from "react";
import { Printer } from "lucide-react";
import { useGetIdentity, useRecordContext } from "ra-core";
import type { Payment } from "@/components/atomic-crm/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PaymentLinesScope } from "./PaymentLinesTable";
import { buildPaymentPrintUrl } from "./paymentPrintUrl";
import { PaymentRegisterPaidDialog } from "./PaymentRegisterPaidDialog";

export const PaymentRunActions = ({ scope }: { scope: PaymentLinesScope }) => {
  const record = useRecordContext<Payment>();
  const { data: identity } = useGetIdentity();
  const [approvePayOpen, setApprovePayOpen] = useState(false);

  if (!record) return null;

  const canPay = canUseCrmPermission(identity as any, "payments.pay");

  const openPrint = (personId?: number | null) => {
    const url = buildPaymentPrintUrl({
      paymentId: record.id,
      scope,
      personId,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {record.status !== "paid" ? (
          <Button
            type="button"
            className="h-9"
            disabled={!canPay}
            onClick={() => setApprovePayOpen(true)}
          >
            Aprobar pago
          </Button>
        ) : null}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => openPrint()}
              aria-label="Print payment"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Print payment</TooltipContent>
        </Tooltip>
      </div>

      <PaymentRegisterPaidDialog
        paymentId={record.id}
        open={approvePayOpen}
        onOpenChange={setApprovePayOpen}
      />
    </>
  );
};
