import { useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { CalendarClock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DealChangeOrder,
  DealClientPayment,
} from "@/components/atomic-crm/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";
import {
  PAYMENT_SCHEDULE_SPLITS,
  PAYMENT_STATUS_OPTIONS,
} from "@/lbs/projects/financials/constants";
import {
  getCollectedPaymentsTotal,
  getProjectCurrentValue,
  getApprovedChangeOrdersTotal,
} from "@/lbs/projects/financials/projectFinancialMetrics";

const isReceivedStatus = (status?: string | null) =>
  status === "cleared" || status === "deposited";

const isLatePayment = (payment: DealClientPayment) => {
  if (isReceivedStatus(payment.status)) return false;
  if (!payment.payment_date) return false;
  return payment.payment_date < new Date().toISOString().slice(0, 10);
};

const paymentStatusLabel = (payment: DealClientPayment) => {
  if (isReceivedStatus(payment.status)) return "Received";
  if (isLatePayment(payment)) return "Late";
  if (payment.status === "pending") return "Planned";
  return payment.status ?? "—";
};

const paymentStatusVariant = (payment: DealClientPayment) => {
  if (isReceivedStatus(payment.status)) return "default" as const;
  if (isLatePayment(payment)) return "destructive" as const;
  return "outline" as const;
};

export const ProjectPaymentsTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_financials.collections.manage");
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const { data: payments = [], isPending } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "payment_date", order: "ASC" },
    },
    { staleTime: 15_000 },
  );
  const { data: changeOrders = [] } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const approvedChangeOrdersTotal = useMemo(
    () => getApprovedChangeOrdersTotal(changeOrders),
    [changeOrders],
  );
  const projectAmount = useMemo(
    () => getProjectCurrentValue(record, approvedChangeOrdersTotal),
    [record, approvedChangeOrdersTotal],
  );
  const totalPaid = useMemo(
    () => getCollectedPaymentsTotal(payments),
    [payments],
  );
  const balance = projectAmount - totalPaid;

  const addPayment = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notify("Enter a valid amount", { type: "warning" });
      return;
    }
    create(
      "deal_client_payments",
      {
        data: {
          deal_id: record.id,
          amount: parsed,
          status: "pending",
          payment_date:
            paymentDate || new Date().toISOString().slice(0, 10),
          reference_number: reference.trim() || null,
        },
      },
      {
        onSuccess: () => {
          notify("Payment recorded", { type: "info" });
          setAmount("");
          setReference("");
          setPaymentDate("");
          refresh();
        },
        onError: () => notify("Could not record payment", { type: "error" }),
      },
    );
  };

  const addPaymentSchedule = async () => {
    if (projectAmount <= 0) {
      notify("Set a project amount before creating a payment schedule", {
        type: "warning",
      });
      return;
    }
    setIsScheduling(true);
    try {
      for (const item of PAYMENT_SCHEDULE_SPLITS) {
        const scheduledAmount = Math.round(projectAmount * (item.percent / 100) * 100) / 100;
        await create(
          "deal_client_payments",
          {
            data: {
              deal_id: record.id,
              amount: scheduledAmount,
              status: "pending",
              payment_date: new Date().toISOString().slice(0, 10),
              reference_number: item.label,
              notes: `${item.percent}% milestone`,
            },
          },
          { returnPromise: true },
        );
      }
      notify("Payment schedule created", { type: "info" });
      refresh();
    } catch {
      notify("Could not create payment schedule", { type: "error" });
    } finally {
      setIsScheduling(false);
    }
  };

  const updatePaymentStatus = (
    payment: DealClientPayment,
    status: DealClientPayment["status"],
  ) => {
    update(
      "deal_client_payments",
      {
        id: payment.id,
        data: { status },
        previousData: payment,
      },
      {
        onSuccess: () => refresh(),
        onError: () => notify("Could not update payment", { type: "error" }),
      },
    );
  };

  if (isPending) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Project value</div>
          <div className="text-lg font-semibold">
            <MoneyText value={projectAmount} />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Collected</div>
          <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
            <MoneyText value={totalPaid} />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-lg font-semibold">
            <MoneyText value={balance} />
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Record payment</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isScheduling || isCreating}
              onClick={() => void addPaymentSchedule()}
            >
              {isScheduling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarClock className="size-4" />
              )}
              Add payment schedule (30/40/30)
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-48"
                placeholder="Deposit, milestone 1…"
              />
            </div>
            <Button type="button" onClick={addPayment} disabled={isCreating}>
              Record payment
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              {canManage ? <TableHead className="w-[140px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="text-muted-foreground"
                >
                  No payments recorded for this project.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={String(payment.id)}>
                  <TableCell>{payment.payment_date ?? "—"}</TableCell>
                  <TableCell>
                    <MoneyText value={payment.amount} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentStatusVariant(payment)}>
                      {paymentStatusLabel(payment)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.reference_number ?? payment.notes ?? "—"}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={payment.status}
                          onValueChange={(value) =>
                            updatePaymentStatus(
                              payment,
                              value as DealClientPayment["status"],
                            )
                          }
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() =>
                            deleteOne(
                              "deal_client_payments",
                              { id: payment.id, previousData: payment },
                              {
                                onSuccess: () => refresh(),
                                onError: () =>
                                  notify("Could not delete", { type: "error" }),
                              },
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
