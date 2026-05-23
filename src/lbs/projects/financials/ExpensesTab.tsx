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
import { Textarea } from "@/components/ui/textarea";
import type { DealExpense } from "@/components/atomic-crm/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";
import {
  WEB_EXPENSE_CATEGORIES,
  WEB_EXPENSE_CATEGORY_LABELS,
} from "./constants";
import { getExpensesTotal } from "./projectFinancialMetrics";

const emptyForm = () => ({
  expense_type: "hosting",
  vendor: "",
  description: "",
  amount: "",
  purchase_date: "",
  paid: false,
  notes: "",
});

export const ExpensesTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_financials.expenses.manage");
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: expenses = [], isPending } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "purchase_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const totalExpenses = useMemo(() => getExpensesTotal(expenses), [expenses]);
  const paidTotal = useMemo(
    () =>
      expenses
        .filter((entry) => entry.paid)
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [expenses],
  );

  const resetCreateForm = () => setForm(emptyForm());

  const handleCreate = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      notify("Enter a valid amount", { type: "warning" });
      return;
    }
    create(
      "deal_expenses",
      {
        data: {
          deal_id: record.id,
          expense_type: form.expense_type,
          vendor: form.vendor.trim() || null,
          description: form.description.trim() || null,
          amount,
          purchase_date: form.purchase_date || null,
          paid: form.paid,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          resetCreateForm();
          refresh();
          notify("Expense added", { type: "info" });
        },
        onError: () => notify("Could not add expense", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: DealExpense) => {
    setEditingId(Number(entry.id));
    setEditForm({
      expense_type: entry.expense_type,
      vendor: entry.vendor ?? "",
      description: entry.description ?? "",
      amount: String(entry.amount ?? 0),
      purchase_date: entry.purchase_date ?? "",
      paid: !!entry.paid,
      notes: entry.notes ?? "",
    });
  };

  const saveEdit = (entry: DealExpense) => {
    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      notify("Enter a valid amount", { type: "warning" });
      return;
    }
    update(
      "deal_expenses",
      {
        id: entry.id,
        data: {
          expense_type: editForm.expense_type,
          vendor: editForm.vendor.trim() || null,
          description: editForm.description.trim() || null,
          amount,
          purchase_date: editForm.purchase_date || null,
          paid: editForm.paid,
          notes: editForm.notes.trim() || null,
        },
        previousData: entry,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          refresh();
          notify("Expense updated", { type: "info" });
        },
        onError: () => notify("Could not update expense", { type: "error" }),
      },
    );
  };

  if (isPending) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Total: <MoneyText value={totalExpenses} className="font-semibold text-foreground" />
        </span>
        <span>
          Paid: <MoneyText value={paidTotal} className="font-semibold text-foreground" />
        </span>
        <span>
          Unpaid:{" "}
          <MoneyText
            value={totalExpenses - paidTotal}
            className="font-semibold text-foreground"
          />
        </span>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Add expense</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.expense_type}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, expense_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEB_EXPENSE_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, vendor: event.target.value }))
                }
                placeholder="Vendor or store"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amount: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Purchase date</Label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    purchase_date: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, paid: event.target.checked }))
                }
              />
              Paid
            </label>
            <div className="space-y-1 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Add expense
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-[88px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="text-muted-foreground"
                >
                  No expenses recorded for this project.
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((entry) => {
                const isEditing = editingId === Number(entry.id);
                return (
                  <TableRow key={String(entry.id)}>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={editForm.expense_type}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              expense_type: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEB_EXPENSE_CATEGORIES.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        WEB_EXPENSE_CATEGORY_LABELS[entry.expense_type] ??
                        entry.expense_type
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.vendor}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              vendor: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        entry.vendor ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        entry.description ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.amount}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              amount: event.target.value,
                            }))
                          }
                          className="w-24"
                        />
                      ) : (
                        <MoneyText value={entry.amount} />
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editForm.purchase_date}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              purchase_date: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        entry.purchase_date ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.paid ? (
                        <Badge variant="secondary">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => saveEdit(entry)}
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
                                onClick={() => startEdit(entry)}
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
                                    "deal_expenses",
                                    { id: entry.id, previousData: entry },
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
