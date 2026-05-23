import { useMemo, useState } from "react";
import { useCreate, useDelete, useGetList, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DealClientPayment } from "@/components/atomic-crm/types";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";

export const ProjectPaymentsTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [deleteOne] = useDelete();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const { data: payments = [], isPending } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { staleTime: 15_000 },
  );

  const totalPaid = useMemo(
    () =>
      payments
        .filter((p) => p.status === "cleared" || p.status === "deposited")
        .reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
    [payments],
  );

  const projectAmount = Number(record.amount ?? record.estimated_value ?? 0);
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
          payment_date: new Date().toISOString().slice(0, 10),
          reference: reference.trim() || null,
        },
      },
      {
        onSuccess: () => {
          notify("Payment recorded", { type: "info" });
          setAmount("");
          setReference("");
          refresh();
        },
        onError: () => notify("Could not record payment", { type: "error" }),
      },
    );
  };

  if (isPending) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Project amount</div>
          <div className="text-lg font-semibold">
            <MoneyText value={projectAmount} />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Collected</div>
          <div className="text-lg font-semibold text-emerald-700">
            <MoneyText value={totalPaid} />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Balance</div>
          <div className="text-lg font-semibold">
            <MoneyText value={balance} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Amount</label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Reference</label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="w-48" />
        </div>
        <Button type="button" onClick={addPayment}>
          Record payment
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No payments recorded for this project.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{payment.payment_date ?? "—"}</TableCell>
                <TableCell>
                  <MoneyText value={payment.amount} />
                </TableCell>
                <TableCell className="capitalize">{payment.status}</TableCell>
                <TableCell>{payment.reference ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      deleteOne(
                        "deal_client_payments",
                        { id: payment.id, previousData: payment },
                        {
                          onSuccess: () => refresh(),
                          onError: () => notify("Could not delete", { type: "error" }),
                        },
                      )
                    }
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
