import { useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
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
import type { DealChangeOrder } from "@/components/atomic-crm/types";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";
import { CHANGE_ORDER_STATUS_OPTIONS } from "./constants";
import { getApprovedChangeOrdersTotal } from "./projectFinancialMetrics";

const emptyForm = () => ({
  title: "",
  description: "",
  change_date: "",
  amount: "",
  reason: "",
  status: "draft",
});

const statusVariant = (status: DealChangeOrder["status"]) => {
  switch (status) {
    case "approved":
      return "default" as const;
    case "sent":
      return "secondary" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const getChangeTypeLabel = (amount: number) =>
  amount === 0 ? "Scope creep (no charge)" : "Billable change";

export const ChangeOrdersTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_financials.change_orders.manage");
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: changeOrders = [], isPending } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "change_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const approvedTotal = useMemo(
    () => getApprovedChangeOrdersTotal(changeOrders),
    [changeOrders],
  );
  const pendingTotal = useMemo(
    () =>
      changeOrders
        .filter((entry) => entry.status === "draft" || entry.status === "sent")
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [changeOrders],
  );

  const handleCreate = () => {
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      notify("Title is required", { type: "warning" });
      return;
    }
    if (!Number.isFinite(amount)) {
      notify("Enter a valid amount", { type: "warning" });
      return;
    }
    create(
      "deal_change_orders",
      {
        data: {
          deal_id: record.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          change_date:
            form.change_date || new Date().toISOString().slice(0, 10),
          amount,
          reason: form.reason.trim() || null,
          status: form.status,
        },
      },
      {
        onSuccess: () => {
          setForm(emptyForm());
          refresh();
          notify("Change order added", { type: "info" });
        },
        onError: () => notify("Could not add change order", { type: "error" }),
      },
    );
  };

  const markSent = (entry: DealChangeOrder) => {
    update(
      "deal_change_orders",
      {
        id: entry.id,
        data: { status: "sent" },
        previousData: entry,
      },
      {
        onSuccess: () => {
          refresh();
          notify("Marked as sent to client", { type: "info" });
        },
        onError: () => notify("Could not update status", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: DealChangeOrder) => {
    setEditingId(Number(entry.id));
    setEditForm({
      title: entry.title,
      description: entry.description ?? "",
      change_date: entry.change_date ?? "",
      amount: String(entry.amount ?? 0),
      reason: entry.reason ?? "",
      status: entry.status,
    });
  };

  const saveEdit = (entry: DealChangeOrder) => {
    const amount = Number(editForm.amount);
    if (!editForm.title.trim() || !Number.isFinite(amount)) {
      notify("Title and amount are required", { type: "warning" });
      return;
    }
    update(
      "deal_change_orders",
      {
        id: entry.id,
        data: {
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          change_date:
            editForm.change_date || new Date().toISOString().slice(0, 10),
          amount,
          reason: editForm.reason.trim() || null,
          status: editForm.status,
        },
        previousData: entry,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          refresh();
          notify("Change order updated", { type: "info" });
        },
        onError: () =>
          notify("Could not update change order", { type: "error" }),
      },
    );
  };

  if (isPending) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Approved:{" "}
          <MoneyText
            value={approvedTotal}
            className="font-semibold text-foreground"
          />
        </span>
        <span>
          Pending:{" "}
          <MoneyText
            value={pendingTotal}
            className="font-semibold text-foreground"
          />
        </span>
      </div>

      {canManage ? (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Add change order</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.change_date}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    change_date: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Amount (+/-)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                placeholder="0 for scope creep"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Reason</Label>
              <Input
                value={form.reason}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reason: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Add change order
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              {canManage ? <TableHead className="w-[120px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {changeOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="text-muted-foreground"
                >
                  No change orders for this project.
                </TableCell>
              </TableRow>
            ) : (
              changeOrders.map((entry) => {
                const amount = Number(entry.amount ?? 0);
                const isEditing = editingId === Number(entry.id);
                return (
                  <TableRow key={String(entry.id)}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        entry.title
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={amount === 0 ? "outline" : "secondary"}>
                        {getChangeTypeLabel(amount)}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.change_date ?? "—"}</TableCell>
                    <TableCell>
                      <MoneyText value={entry.amount} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(entry.status)}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AuthorBadge memberId={entry.created_by_member_id} />
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {entry.status === "draft" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Send to client"
                              onClick={() => markSent(entry)}
                            >
                              <Send className="size-4" />
                            </Button>
                          ) : null}
                          {isEditing ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveEdit(entry)}
                              disabled={isUpdating}
                            >
                              Save
                            </Button>
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
                                    "deal_change_orders",
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
