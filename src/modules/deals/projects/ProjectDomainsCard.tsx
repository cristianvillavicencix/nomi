import { useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { SecurityFloatingInput } from "@/modules/deals/projects/securityFloatingFields";
import type { DealDomain, LbsDeal } from "@/modules/types";

type DomainForm = {
  domain: string;
  registrar: string;
  registered_at: string;
  renewal_at: string;
};

const emptyForm = (): DomainForm => ({
  domain: "",
  registrar: "",
  registered_at: "",
  renewal_at: "",
});

const fromRecord = (row: DealDomain): DomainForm => ({
  domain: row.domain ?? "",
  registrar: row.registrar ?? "",
  registered_at: String(row.registered_at ?? "").slice(0, 10),
  renewal_at: String(row.renewal_at ?? "").slice(0, 10),
});

export const ProjectDomainsCard = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const canManage = useMemberCapability("deal_operations.credentials.manage");
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DealDomain | null>(null);
  const [form, setForm] = useState<DomainForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const { data: domains = [], error, isPending } = useGetList<DealDomain>(
    "deal_domains",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { ...supabaseTableQueryOptions("deal_domains") },
  );

  if (isSupabaseSchemaMissingError(error, "deal_domains")) {
    return (
      <div className="text-sm text-muted-foreground">
        {getSupabaseSchemaMissingMessage("deal_domains")}
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: DealDomain) => {
    setEditing(row);
    setForm(fromRecord(row));
    setOpen(true);
  };

  const save = async () => {
    if (!canManage) return;
    const domain = form.domain.trim();
    if (!domain) {
      notify("Domain is required", { type: "warning" });
      return;
    }
    setSaving(true);
    const payload = {
      deal_id: record.id,
      domain,
      registrar: form.registrar.trim() || null,
      registered_at: form.registered_at.trim() || null,
      renewal_at: form.renewal_at.trim() || null,
      sort_order: editing?.sort_order ?? domains.length,
    };
    try {
      if (editing) {
        await update(
          "deal_domains",
          { id: editing.id, data: payload, previousData: editing },
          { returnPromise: true },
        );
        notify("Domain updated");
      } else {
        await create(
          "deal_domains",
          { data: payload },
          { returnPromise: true },
        );
        notify("Domain added");
      }
      setOpen(false);
      refresh();
    } catch (saveError) {
      notify(
        saveError instanceof Error ? saveError.message : "Could not save domain",
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: DealDomain) => {
    if (!canManage) return;
    if (!window.confirm(`Delete domain ${row.domain}?`)) return;
    setDeletingId(row.id);
    try {
      await deleteOne(
        "deal_domains",
        { id: row.id, previousData: row },
        { returnPromise: true },
      );
      notify("Domain deleted");
      refresh();
    } catch (deleteError) {
      notify(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete domain",
        { type: "error" },
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Domains</h3>
        {canManage ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add domain
          </Button>
        ) : null}
      </div>
      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">No domains yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Registrar</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead className="w-[88px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domains.map((row) => (
              <TableRow key={String(row.id)}>
                <TableCell className="font-medium">{row.domain}</TableCell>
                <TableCell>{row.registrar || "—"}</TableCell>
                <TableCell>
                  {row.renewal_at ? String(row.renewal_at).slice(0, 10) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <IconButton
                      aria-label="Edit domain"
                      disabled={!canManage}
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      aria-label="Delete domain"
                      className="text-destructive"
                      disabled={!canManage || deletingId === row.id}
                      onClick={() => void remove(row)}
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </IconButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit domain" : "Add domain"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <SecurityFloatingInput
              id="domain-name"
              label="Domain"
              required
              className="sm:col-span-2"
              value={form.domain}
              placeholder="example.com"
              onChange={(value) =>
                setForm((current) => ({ ...current, domain: value }))
              }
            />
            <SecurityFloatingInput
              id="domain-registrar"
              label="Registrar"
              className="sm:col-span-2"
              value={form.registrar}
              placeholder="Namecheap, GoDaddy…"
              onChange={(value) =>
                setForm((current) => ({ ...current, registrar: value }))
              }
            />
            <SecurityFloatingInput
              id="domain-registered"
              label="Registered"
              type="date"
              value={form.registered_at}
              onChange={(value) =>
                setForm((current) => ({ ...current, registered_at: value }))
              }
            />
            <SecurityFloatingInput
              id="domain-renewal"
              label="Renewal"
              type="date"
              value={form.renewal_at}
              onChange={(value) =>
                setForm((current) => ({ ...current, renewal_at: value }))
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
