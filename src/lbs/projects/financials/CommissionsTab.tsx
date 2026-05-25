import { useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
  DealClientPayment,
  DealCommission,
  Person,
} from "@/components/atomic-crm/types";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";
import { getCollectedPaymentsTotal } from "./projectFinancialMetrics";

const emptyForm = () => ({
  salesperson_id: "",
  commission_type: "percentage",
  commission_value: "",
  basis: "payments_collected",
  paid: false,
  notes: "",
});

export const CommissionsTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_financials.commissions.manage");
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: commissions = [], isPending } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: salespeople = [] } = useGetList<Person>(
    "people",
    {
      filter: { "type@eq": "salesperson" },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );
  const { data: payments = [] } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const salespersonById = useMemo(
    () =>
      Object.fromEntries(
        salespeople.map((person) => [Number(person.id), person]),
      ),
    [salespeople],
  );
  const collectedAmount = useMemo(
    () => getCollectedPaymentsTotal(payments),
    [payments],
  );
  const rows = useMemo(
    () =>
      commissions.map((commission) => {
        const value = Number(commission.commission_value ?? 0);
        const earned =
          commission.commission_type === "fixed"
            ? value
            : commission.basis === "payments_collected"
              ? collectedAmount * (value / 100)
              : 0;
        return { commission, earned };
      }),
    [commissions, collectedAmount],
  );
  const totalEarned = useMemo(
    () => rows.reduce((sum, row) => sum + row.earned, 0),
    [rows],
  );
  const totalPaid = useMemo(
    () =>
      rows
        .filter((row) => row.commission.paid)
        .reduce((sum, row) => sum + row.earned, 0),
    [rows],
  );

  const handleCreate = () => {
    const salespersonId = Number(form.salesperson_id);
    const value = Number(form.commission_value);
    if (!Number.isFinite(salespersonId) || salespersonId <= 0) {
      notify("Select a salesperson", { type: "warning" });
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      notify("Enter a valid commission value", { type: "warning" });
      return;
    }
    create(
      "deal_commissions",
      {
        data: {
          deal_id: record.id,
          salesperson_id: salespersonId,
          commission_type: form.commission_type,
          commission_value: value,
          basis: form.basis,
          paid: form.paid,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setForm(emptyForm());
          refresh();
          notify("Commission added", { type: "info" });
        },
        onError: () => notify("Could not add commission", { type: "error" }),
      },
    );
  };

  const startEdit = (commission: DealCommission) => {
    setEditingId(Number(commission.id));
    setEditForm({
      salesperson_id: String(commission.salesperson_id),
      commission_type: commission.commission_type,
      commission_value: String(commission.commission_value ?? 0),
      basis: commission.basis,
      paid: !!commission.paid,
      notes: commission.notes ?? "",
    });
  };

  const saveEdit = (commission: DealCommission) => {
    const value = Number(editForm.commission_value);
    if (!Number.isFinite(value) || value < 0) {
      notify("Enter a valid commission value", { type: "warning" });
      return;
    }
    update(
      "deal_commissions",
      {
        id: commission.id,
        data: {
          commission_type: editForm.commission_type,
          commission_value: value,
          basis: editForm.basis,
          paid: editForm.paid,
          notes: editForm.notes.trim() || null,
        },
        previousData: commission,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          refresh();
          notify("Commission updated", { type: "info" });
        },
        onError: () => notify("Could not update commission", { type: "error" }),
      },
    );
  };

  if (isPending) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Earned:{" "}
          <MoneyText
            value={totalEarned}
            className="font-semibold text-foreground"
          />
        </span>
        <span>
          Paid:{" "}
          <MoneyText
            value={totalPaid}
            className="font-semibold text-foreground"
          />
        </span>
        <span>
          Payable:{" "}
          <MoneyText
            value={totalEarned - totalPaid}
            className="font-semibold text-foreground"
          />
        </span>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Add commission</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Salesperson</Label>
              <Select
                value={form.salesperson_id}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, salesperson_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {salespeople.map((person) => (
                    <SelectItem
                      key={String(person.id)}
                      value={String(person.id)}
                    >
                      {person.first_name} {person.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.commission_type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, commission_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.commission_value}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    commission_value: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Add commission
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Salesperson</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Earned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              {canManage ? <TableHead className="w-[88px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="text-muted-foreground"
                >
                  No commissions on this project yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ commission, earned }) => {
                const person =
                  salespersonById[Number(commission.salesperson_id)];
                const isEditing = editingId === Number(commission.id);
                return (
                  <TableRow key={String(commission.id)}>
                    <TableCell>
                      {person
                        ? `${person.first_name} ${person.last_name}`
                        : `#${commission.salesperson_id}`}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.commission_value}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              commission_value: event.target.value,
                            }))
                          }
                          className="w-24"
                        />
                      ) : commission.commission_type === "percentage" ? (
                        `${commission.commission_value}%`
                      ) : (
                        <MoneyText value={commission.commission_value} />
                      )}
                    </TableCell>
                    <TableCell>
                      <MoneyText value={earned} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={commission.paid ? "default" : "outline"}>
                        {commission.paid ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AuthorBadge memberId={commission.created_by_member_id} />
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => saveEdit(commission)}
                                disabled={isUpdating}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => startEdit(commission)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                disabled={isDeleting}
                                onClick={() =>
                                  deleteOne(
                                    "deal_commissions",
                                    {
                                      id: commission.id,
                                      previousData: commission,
                                    },
                                    {
                                      onSuccess: () => refresh(),
                                      onError: () =>
                                        notify("Could not delete", {
                                          type: "error",
                                        }),
                                    },
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
