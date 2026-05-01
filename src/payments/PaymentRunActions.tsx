import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useGetIdentity, useGetList, useGetMany, useRecordContext } from "ra-core";
import type { Deal, Payment, PaymentLine, Person } from "@/components/atomic-crm/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PaymentLinesScope } from "./PaymentLinesTable";
import { PaymentPrintDocument } from "./PaymentsShow";
import { PaymentRegisterPaidDialog } from "./PaymentRegisterPaidDialog";

function PrintTrigger({
  paymentId,
  scope,
  personId,
  onDone,
}: {
  paymentId: Payment["id"];
  scope: PaymentLinesScope;
  personId?: number | null;
  onDone: () => void;
}) {
  const { data: lines = [], isPending } = useGetList<PaymentLine>(
    "payment_lines",
    {
      pagination: { page: 1, perPage: 2000 },
      sort: { field: "id", order: "ASC" },
      filter: { payment_id: paymentId },
    },
  );

  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((l) => l.person_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [lines],
  );
  const projectIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((l) => l.project_id)
            .filter((id): id is NonNullable<typeof id> => id != null),
        ),
      ),
    [lines],
  );

  const { data: people = [] } = useGetMany<Person>(
    "people",
    { ids: personIds },
    { enabled: personIds.length > 0 },
  );
  const { data: projects = [] } = useGetMany<Deal>(
    "deals",
    { ids: projectIds },
    { enabled: projectIds.length > 0 },
  );

  useEffect(() => {
    if (isPending) return;
    const timer = setTimeout(() => {
      window.print();
      onDone();
    }, 150);
    return () => clearTimeout(timer);
  }, [isPending, onDone]);

  // Visually hidden on screen; the @media print CSS makes .payment-print-only visible
  return (
    <div style={{ visibility: "hidden", height: 0, overflow: "visible" }}>
      <PaymentPrintDocument
        activePersonId={personId ?? null}
        lines={lines}
        people={people}
        projects={projects}
        scope={scope}
      />
    </div>
  );
}

export const PaymentRunActions = ({ scope }: { scope: PaymentLinesScope }) => {
  const record = useRecordContext<Payment>();
  const { data: identity } = useGetIdentity();
  const [printing, setPrinting] = useState(false);
  const [approvePayOpen, setApprovePayOpen] = useState(false);

  if (!record) return null;

  const canPay = canUseCrmPermission(identity as any, "payments.pay");

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
              disabled={printing}
              onClick={() => setPrinting(true)}
              aria-label="Print payment"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Print payment</TooltipContent>
        </Tooltip>
      </div>

      {printing && (
        <PrintTrigger
          paymentId={record.id}
          scope={scope}
          onDone={() => setPrinting(false)}
        />
      )}

      <PaymentRegisterPaidDialog
        paymentId={record.id}
        open={approvePayOpen}
        onOpenChange={setApprovePayOpen}
      />
    </>
  );
};
