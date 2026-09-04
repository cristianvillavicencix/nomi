import { useState } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useUpdate,
  useRefresh,
} from "ra-core";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/modules/deals/supabaseSchemaErrors";
import {
  SecurityFloatingInput,
  SecurityFloatingTextarea,
} from "@/modules/deals/projects/securityFloatingFields";
import type { DealHosting, LbsDeal } from "@/modules/types";

type HostingForm = {
  provider: string;
  plan_name: string;
  started_at: string;
  renewal_at: string;
  notes: string;
};

const emptyForm = (): HostingForm => ({
  provider: "",
  plan_name: "",
  started_at: "",
  renewal_at: "",
  notes: "",
});

const fromRecord = (row?: DealHosting | null): HostingForm => ({
  provider: row?.provider ?? "",
  plan_name: row?.plan_name ?? "",
  started_at: String(row?.started_at ?? "").slice(0, 10),
  renewal_at: String(row?.renewal_at ?? "").slice(0, 10),
  notes: row?.notes ?? "",
});

const formatDate = (value?: string | null) =>
  value ? String(value).slice(0, 10) : "—";

export const ProjectHostingCard = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_operations.credentials.manage");
  const [create] = useCreate();
  const [update] = useUpdate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HostingForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], error, isPending } = useGetList<DealHosting>(
    "deal_hosting",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { ...supabaseTableQueryOptions("deal_hosting") },
  );

  const existing = rows[0] ?? null;

  if (isSupabaseSchemaMissingError(error, "deal_hosting")) {
    return (
      <div className="text-sm text-muted-foreground">
        {getSupabaseSchemaMissingMessage("deal_hosting")}
      </div>
    );
  }

  const openEditor = () => {
    setForm(fromRecord(existing));
    setOpen(true);
  };

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    const payload = {
      deal_id: record.id,
      provider: form.provider.trim() || null,
      plan_name: form.plan_name.trim() || null,
      started_at: form.started_at.trim() || null,
      renewal_at: form.renewal_at.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (existing) {
        await update(
          "deal_hosting",
          { id: existing.id, data: payload, previousData: existing },
          { returnPromise: true },
        );
      } else {
        await create(
          "deal_hosting",
          { data: payload },
          { returnPromise: true },
        );
      }
      notify("Hosting details saved");
      setOpen(false);
      refresh();
    } catch (saveError) {
      notify(
        saveError instanceof Error
          ? saveError.message
          : "Could not save hosting details",
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Hosting</h3>
        {canManage ? (
          <Button type="button" size="sm" onClick={openEditor}>
            {existing ? (
              <>
                <Pencil className="size-4" />
                Edit
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Add hosting
              </>
            )}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : !existing ? (
        <p className="text-sm text-muted-foreground">No hosting details yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead>Notes</TableHead>
              {canManage ? (
                <TableHead className="w-[56px] text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                {existing.provider || "—"}
              </TableCell>
              <TableCell>{existing.plan_name || "—"}</TableCell>
              <TableCell>{formatDate(existing.started_at)}</TableCell>
              <TableCell>{formatDate(existing.renewal_at)}</TableCell>
              <TableCell className="max-w-[240px] truncate whitespace-normal">
                {existing.notes || "—"}
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <IconButton
                    aria-label="Edit hosting"
                    onClick={openEditor}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                </TableCell>
              ) : null}
            </TableRow>
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit hosting" : "Add hosting"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <SecurityFloatingInput
              id="hosting-provider"
              label="Provider"
              value={form.provider}
              placeholder="Coolify, Hostinger, Vercel…"
              onChange={(value) =>
                setForm((current) => ({ ...current, provider: value }))
              }
            />
            <SecurityFloatingInput
              id="hosting-plan"
              label="Plan"
              value={form.plan_name}
              placeholder="Pro, Shared…"
              onChange={(value) =>
                setForm((current) => ({ ...current, plan_name: value }))
              }
            />
            <SecurityFloatingInput
              id="hosting-started"
              label="Started"
              type="date"
              value={form.started_at}
              onChange={(value) =>
                setForm((current) => ({ ...current, started_at: value }))
              }
            />
            <SecurityFloatingInput
              id="hosting-renewal"
              label="Renewal"
              type="date"
              value={form.renewal_at}
              onChange={(value) =>
                setForm((current) => ({ ...current, renewal_at: value }))
              }
            />
            <SecurityFloatingTextarea
              id="hosting-notes"
              label="Notes"
              className="sm:col-span-2"
              rows={3}
              value={form.notes}
              placeholder="Deploy notes, server nickname…"
              onChange={(value) =>
                setForm((current) => ({ ...current, notes: value }))
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
