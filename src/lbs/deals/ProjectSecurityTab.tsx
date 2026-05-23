import { useMemo, useState } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useUpdate,
  type Identifier,
} from "ra-core";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyDealAccessFormValues,
  normalizeAccessUrl,
  PROJECT_ACCESS_PRESETS,
  type DealAccessFormValues,
} from "@/lbs/deals/projectAccessConstants";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/lbs/deals/supabaseSchemaErrors";
import type { DealAccessEntry, LbsDeal } from "@/lbs/types";

const copyToClipboard = async (
  value: string,
  notify: ReturnType<typeof useNotify>,
) => {
  if (!value.trim()) return;
  await navigator.clipboard.writeText(value.trim());
  notify("Copied to clipboard", { type: "info" });
};

const formatAccessEntryForCopy = (entry: DealAccessEntry) => {
  const lines = [`Label: ${entry.label}`];
  if (entry.url?.trim()) lines.push(`URL: ${entry.url.trim()}`);
  if (entry.username?.trim()) lines.push(`Username: ${entry.username.trim()}`);
  if (entry.password?.trim()) lines.push(`Password: ${entry.password.trim()}`);
  if (entry.notes?.trim()) lines.push(`Notes: ${entry.notes.trim()}`);
  return lines.join("\n");
};

const AccessEntryRow = ({
  entry,
  onEdit,
  onDelete,
  isDeleting,
}: {
  entry: DealAccessEntry;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) => {
  const notify = useNotify();
  const [showPassword, setShowPassword] = useState(false);
  const href = normalizeAccessUrl(entry.url);

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        {entry.label}
      </TableCell>
      <TableCell className="max-w-[220px]">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-sm link-action"
            title={entry.url ?? undefined}
          >
            <span className="truncate">{entry.url}</span>
            <ExternalLink className="size-3.5 shrink-0" />
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[160px]">
        {entry.username?.trim() ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">{entry.username}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => copyToClipboard(entry.username ?? "", notify)}
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy username</span>
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[180px]">
        {entry.password?.trim() ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {showPassword ? entry.password : "••••••••"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              <span className="sr-only">Toggle password visibility</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => copyToClipboard(entry.password ?? "", notify)}
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy password</span>
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={async () => {
              const text = formatAccessEntryForCopy(entry);
              if (!text.trim()) return;
              await navigator.clipboard.writeText(text);
              notify("All credentials copied", { type: "info" });
            }}
            title="Copy all credentials"
          >
            <Copy className="size-4" />
            <span className="sr-only">Copy all</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const AccessEntryDialog = ({
  open,
  title,
  values,
  onChange,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  title: string;
  values: DealAccessFormValues;
  onChange: (values: DealAccessFormValues) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
}) => {
  const presetMatch = PROJECT_ACCESS_PRESETS.includes(
    values.label as (typeof PROJECT_ACCESS_PRESETS)[number],
  )
    ? values.label
    : "Other";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>What is this for?</Label>
            <Select
              value={presetMatch}
              onValueChange={(next) => {
                onChange({
                  ...values,
                  label: next === "Other" ? values.label : next,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ACCESS_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presetMatch === "Other" ||
            !PROJECT_ACCESS_PRESETS.includes(values.label as never) ? (
              <Input
                value={values.label}
                onChange={(event) =>
                  onChange({ ...values, label: event.target.value })
                }
                placeholder="Custom label, e.g. Shopify admin"
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-url">Login URL</Label>
            <Input
              id="access-url"
              value={values.url}
              onChange={(event) =>
                onChange({ ...values, url: event.target.value })
              }
              placeholder="https://example.com/wp-admin"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-username">Username</Label>
              <Input
                id="access-username"
                value={values.username}
                onChange={(event) =>
                  onChange({ ...values, username: event.target.value })
                }
                placeholder="admin@client.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-password">Password</Label>
              <Input
                id="access-password"
                type="text"
                value={values.password}
                onChange={(event) =>
                  onChange({ ...values, password: event.target.value })
                }
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-notes">Notes (optional)</Label>
            <Textarea
              id="access-notes"
              value={values.notes}
              onChange={(event) =>
                onChange({ ...values, notes: event.target.value })
              }
              rows={3}
              placeholder="2FA codes, recovery email, server IP, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !values.label.trim()}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ProjectSecurityTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Identifier | null>(null);
  const [values, setValues] = useState<DealAccessFormValues>(
    emptyDealAccessFormValues(),
  );
  const [deletingId, setDeletingId] = useState<Identifier | null>(null);

  const {
    data: entries = [],
    isPending,
    isError,
    error,
  } = useGetList<DealAccessEntry>(
    "deal_access_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 15_000, ...supabaseTableQueryOptions("deal_access_entries") },
  );

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingId) ?? null,
    [entries, editingId],
  );

  const openCreate = () => {
    setEditingId(null);
    setValues(emptyDealAccessFormValues());
    setDialogOpen(true);
  };

  const openEdit = (entry: DealAccessEntry) => {
    setEditingId(entry.id);
    setValues({
      label: entry.label ?? "",
      url: entry.url ?? "",
      username: entry.username ?? "",
      password: entry.password ?? "",
      notes: entry.notes ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setValues(emptyDealAccessFormValues());
  };

  const handleSave = async () => {
    if (!values.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }

    const payload = {
      label: values.label.trim(),
      url: values.url.trim() || null,
      username: values.username.trim() || null,
      password: values.password.trim() || null,
      notes: values.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingEntry) {
        await update(
          "deal_access_entries",
          {
            id: editingEntry.id,
            data: payload,
            previousData: editingEntry,
          },
          { returnPromise: true },
        );
        notify("Access updated");
      } else {
        await create(
          "deal_access_entries",
          {
            data: {
              deal_id: record.id,
              ...payload,
            },
          },
          { returnPromise: true },
        );
        notify("Access saved");
      }
      closeDialog();
    } catch (saveError) {
      if (isSupabaseSchemaMissingError(saveError, "deal_access_entries")) {
        notify(getSupabaseSchemaMissingMessage("deal_access_entries"), {
          type: "error",
        });
        return;
      }
      notify("Failed to save access", { type: "error" });
    }
  };

  const handleDelete = async (entry: DealAccessEntry) => {
    setDeletingId(entry.id);
    try {
      await deleteOne(
        "deal_access_entries",
        { id: entry.id, previousData: entry },
        { returnPromise: true },
      );
      notify("Access removed");
    } catch {
      notify("Failed to remove access", { type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  if (isPending) return null;

  if (isError && isSupabaseSchemaMissingError(error, "deal_access_entries")) {
    return (
      <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-6">
        <h3 className="text-base font-semibold">Security module not ready</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {getSupabaseSchemaMissingMessage("deal_access_entries")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load access entries. Try refreshing the page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
        <div className="flex items-start gap-2 min-w-0">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <p>
            Only your team can see these credentials. Avoid sharing this tab
            with clients.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" />
          Add access
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <KeyRound className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No access entries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add hosting, WordPress, FTP, and other logins used to build this
            project.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <AccessEntryRow
                  key={String(entry.id)}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => handleDelete(entry)}
                  isDeleting={isDeleting && deletingId === entry.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AccessEntryDialog
        open={dialogOpen}
        title={editingEntry ? "Edit access" : "Add access"}
        values={values}
        onChange={setValues}
        onClose={closeDialog}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />
    </div>
  );
};
