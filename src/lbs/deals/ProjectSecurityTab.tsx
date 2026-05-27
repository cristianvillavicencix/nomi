import { useMemo, useState } from "react";
import {
  useCreate,
  useDataProvider,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
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
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { DealAccessEntry, DealSecret, LbsDeal } from "@/lbs/types";

const inferKindFromEntry = (entry: DealAccessEntry) => {
  if (entry.kind) return String(entry.kind);
  const label = String(entry.label ?? "").toLowerCase();
  if (label.includes("api key")) return "api_key";
  return "login";
};

const emptySecretFormValues = () => ({
  label: "",
  secret_label: "API key",
  value: "",
  notes: "",
});

const copyToClipboard = async (
  value: string,
  notify: ReturnType<typeof useNotify>,
) => {
  if (!value.trim()) return;
  await navigator.clipboard.writeText(value.trim());
  notify("Copied to clipboard", { type: "info" });
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
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const href = normalizeAccessUrl(entry.url);
  const hasPassword = entry.has_password === true;

  const revealPassword = async () => {
    if (revealedPassword != null) {
      setShowPassword(true);
      return;
    }
    setIsRevealing(true);
    try {
      const password = await dataProvider.getAccessEntryPassword(entry.id);
      setRevealedPassword(password);
      setShowPassword(Boolean(password));
      if (!password) {
        notify("No password stored for this entry", { type: "warning" });
      }
    } catch {
      notify("Failed to reveal password", { type: "error" });
    } finally {
      setIsRevealing(false);
    }
  };

  const hidePassword = () => {
    setShowPassword(false);
  };

  const copyPassword = async () => {
    let password = revealedPassword;
    if (password == null && hasPassword) {
      setIsRevealing(true);
      try {
        password = await dataProvider.getAccessEntryPassword(entry.id);
        setRevealedPassword(password);
      } catch {
        notify("Failed to copy password", { type: "error" });
        return;
      } finally {
        setIsRevealing(false);
      }
    }
    if (!password?.trim()) return;
    await copyToClipboard(password, notify);
    try {
      await dataProvider.logAccessEntryAudit(entry.id, "copied");
    } catch {
      // Non-blocking: clipboard copy already succeeded.
    }
  };

  const copyAll = async () => {
    const lines = [`Label: ${entry.label}`];
    if (entry.url?.trim()) lines.push(`URL: ${entry.url.trim()}`);
    const apiKeyMode = inferKindFromEntry(entry) === "api_key";
    if (!apiKeyMode && entry.username?.trim()) {
      lines.push(`Username: ${entry.username.trim()}`);
    }
    if (hasPassword) {
      let password = revealedPassword;
      if (password == null) {
        try {
          password = await dataProvider.getAccessEntryPassword(entry.id);
          setRevealedPassword(password);
        } catch {
          notify("Failed to copy credentials", { type: "error" });
          return;
        }
      }
      if (password?.trim()) {
        const secretLabel = (entry.secret_label || "").trim();
        const lineLabel = secretLabel || (apiKeyMode ? "API key" : "Password");
        lines.push(`${lineLabel}: ${password.trim()}`);
      }
    }
    if (entry.notes?.trim()) lines.push(`Notes: ${entry.notes.trim()}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    notify("All credentials copied", { type: "info" });
    if (hasPassword) {
      try {
        await dataProvider.logAccessEntryAudit(entry.id, "copied");
      } catch {
        // Non-blocking.
      }
    }
  };

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
        {hasPassword ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {showPassword && revealedPassword
                ? revealedPassword
                : "••••••••"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              disabled={isRevealing}
              onClick={() =>
                showPassword ? hidePassword() : void revealPassword()
              }
            >
              {isRevealing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              <span className="sr-only">
                {showPassword ? "Hide password" : "Reveal password"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              disabled={isRevealing}
              onClick={() => void copyPassword()}
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
            onClick={() => void copyAll()}
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
  isEditing,
}: {
  open: boolean;
  title: string;
  values: DealAccessFormValues;
  onChange: (values: DealAccessFormValues) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isEditing: boolean;
}) => {
  const presetMatch = PROJECT_ACCESS_PRESETS.includes(
    values.label as (typeof PROJECT_ACCESS_PRESETS)[number],
  )
    ? values.label
    : "Other";
  const apiKeyMode = values.kind === "api_key";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={presetMatch}
              onValueChange={(next) => {
                const inferredKind =
                  next === "API key"
                    ? "api_key"
                    : next === "Other"
                      ? values.kind
                      : "login";
                onChange({
                  ...values,
                  label: next === "Other" ? values.label : next,
                  kind: inferredKind,
                  secret_label:
                    inferredKind === "api_key"
                      ? values.secret_label || "API key"
                      : values.secret_label || "Password",
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
          {apiKeyMode ? (
            <div className="space-y-2">
              <Label htmlFor="access-password">
                {values.secret_label?.trim() || "API key"}
              </Label>
              <Input
                id="access-password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) =>
                  onChange({ ...values, password: event.target.value })
                }
                placeholder={isEditing ? "Leave blank to keep unchanged" : "Paste API key"}
              />
              <div className="space-y-1">
                <Label htmlFor="access-secret-label" className="text-xs text-muted-foreground">
                  Secret label (optional)
                </Label>
                <Input
                  id="access-secret-label"
                  value={values.secret_label}
                  onChange={(event) =>
                    onChange({ ...values, secret_label: event.target.value })
                  }
                  placeholder="API key / Token / Secret"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: puedes guardar keys, tokens o secrets aquí. URL y username no aplican.
              </p>
            </div>
          ) : (
            <>
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
                    type="password"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(event) =>
                      onChange({ ...values, password: event.target.value })
                    }
                    placeholder={
                      isEditing ? "Leave blank to keep unchanged" : "••••••••"
                    }
                  />
                </div>
              </div>
            </>
          )}
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

const SecretDialog = ({
  open,
  title,
  values,
  onChange,
  onClose,
  onSave,
  isSaving,
  isEditing,
}: {
  open: boolean;
  title: string;
  values: { label: string; secret_label: string; value: string; notes: string };
  onChange: (values: { label: string; secret_label: string; value: string; notes: string }) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isEditing: boolean;
}) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-1">
        <div className="space-y-2">
          <Label htmlFor="secret-label">Label</Label>
          <Input
            id="secret-label"
            value={values.label}
            onChange={(event) => onChange({ ...values, label: event.target.value })}
            placeholder="Place API key"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret-kind">Secret label (optional)</Label>
          <Input
            id="secret-kind"
            value={values.secret_label}
            onChange={(event) => onChange({ ...values, secret_label: event.target.value })}
            placeholder="API key / Token / Secret"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret-value">{values.secret_label?.trim() || "Secret"}</Label>
          <Input
            id="secret-value"
            type="password"
            autoComplete="new-password"
            value={values.value}
            onChange={(event) => onChange({ ...values, value: event.target.value })}
            placeholder={isEditing ? "Leave blank to keep unchanged" : "Paste value"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret-notes">Notes (optional)</Label>
          <Textarea
            id="secret-notes"
            value={values.notes}
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
            rows={3}
            placeholder="Where it’s used, scopes, rotation schedule, etc."
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

const SecretRow = ({
  secret,
  onEdit,
  onDelete,
  isDeleting,
}: {
  secret: DealSecret;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const hasSecret = secret.has_secret === true;

  const reveal = async () => {
    if (revealed != null) {
      setShow(true);
      return;
    }
    setIsRevealing(true);
    try {
      const value = await dataProvider.getDealSecretValue(secret.id);
      setRevealed(value);
      setShow(Boolean(value));
      if (!value) {
        notify("No secret stored for this entry", { type: "warning" });
      }
    } catch {
      notify("Failed to reveal secret", { type: "error" });
    } finally {
      setIsRevealing(false);
    }
  };

  const copy = async () => {
    let value = revealed;
    if (value == null && hasSecret) {
      setIsRevealing(true);
      try {
        value = await dataProvider.getDealSecretValue(secret.id);
        setRevealed(value);
      } catch {
        notify("Failed to copy secret", { type: "error" });
        return;
      } finally {
        setIsRevealing(false);
      }
    }
    if (!value?.trim()) return;
    await copyToClipboard(value, notify);
    try {
      await dataProvider.logDealSecretAudit(secret.id, "copied");
    } catch {
      // Non-blocking
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">{secret.label}</TableCell>
      <TableCell className="max-w-[220px]">
        <span className="text-sm text-muted-foreground">
          {(secret.secret_label || "Secret").trim()}
        </span>
      </TableCell>
      <TableCell className="max-w-[240px]">
        {hasSecret ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {show && revealed ? revealed : "••••••••"}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => (show ? setShow(false) : void reveal())}
              disabled={isRevealing}
            >
              {isRevealing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : show ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              <span className="sr-only">
                {show ? "Hide secret" : "Reveal secret"}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => void copy()}
              disabled={isRevealing}
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy secret</span>
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-[88px] text-right">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onEdit}>
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
            {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export const ProjectSecurityTab = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [createSecret, { isPending: isCreatingSecret }] = useCreate();
  const [updateSecret, { isPending: isUpdatingSecret }] = useUpdate();
  const [deleteSecret, { isPending: isDeletingSecret }] = useDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Identifier | null>(null);
  const [values, setValues] = useState<DealAccessFormValues>(
    emptyDealAccessFormValues(),
  );
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [editingSecretId, setEditingSecretId] = useState<Identifier | null>(null);
  const [secretValues, setSecretValues] = useState(() => emptySecretFormValues());
  const [deletingId, setDeletingId] = useState<Identifier | null>(null);
  const [deletingSecretId, setDeletingSecretId] = useState<Identifier | null>(null);
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false);

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

  const {
    data: secrets = [],
    isPending: isSecretsPending,
    isError: isSecretsError,
    error: secretsError,
  } = useGetList<DealSecret>(
    "deal_secrets",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 15_000, ...supabaseTableQueryOptions("deal_secrets") },
  );

  const { data: legacyCount = 0, refetch: refetchLegacyCount } = useQuery({
    queryKey: ["legacy-access-entry-password-count"],
    queryFn: () => dataProvider.getLegacyAccessEntryPasswordCount(),
    staleTime: 60_000,
    retry: false,
  });

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingId) ?? null,
    [entries, editingId],
  );

  const openCreate = () => {
    setEditingId(null);
    setValues(emptyDealAccessFormValues());
    setDialogOpen(true);
  };

  const openCreateSecret = () => {
    setEditingSecretId(null);
    setSecretValues(emptySecretFormValues());
    setSecretDialogOpen(true);
  };

  const openEdit = (entry: DealAccessEntry) => {
    const inferredKind = inferKindFromEntry(entry);
    setEditingId(entry.id);
    setValues({
      label: entry.label ?? "",
      kind: (inferredKind as DealAccessFormValues["kind"]) ?? "login",
      secret_label:
        entry.secret_label ??
        (inferredKind === "api_key" ? "API key" : "Password"),
      url: entry.url ?? "",
      username: entry.username ?? "",
      password: "",
      notes: entry.notes ?? "",
    });
    setDialogOpen(true);
  };

  const openEditSecret = (secret: DealSecret) => {
    setEditingSecretId(secret.id);
    setSecretValues({
      label: secret.label ?? "",
      secret_label: secret.secret_label ?? "API key",
      value: "",
      notes: secret.notes ?? "",
    });
    setSecretDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setValues(emptyDealAccessFormValues());
  };

  const closeSecretDialog = () => {
    setSecretDialogOpen(false);
    setEditingSecretId(null);
    setSecretValues(emptySecretFormValues());
  };

  const handleSave = async () => {
    if (!values.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }

    const passwordProvided = values.password.trim().length > 0;
    const payload = {
      label: values.label.trim(),
      kind: values.kind,
      secret_label: values.secret_label.trim() || null,
      url: values.url.trim() || null,
      username: values.username.trim() || null,
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
        if (passwordProvided) {
          await dataProvider.setAccessEntryPassword(
            editingEntry.id,
            values.password.trim(),
          );
        }
        notify("Access updated");
      } else {
        const created = await create(
          "deal_access_entries",
          {
            data: {
              deal_id: record.id,
              ...payload,
            },
          },
          { returnPromise: true },
        );
        const entryId = created?.id;
        if (entryId != null && passwordProvided) {
          await dataProvider.setAccessEntryPassword(
            entryId,
            values.password.trim(),
          );
        }
        if (entryId != null) {
          try {
            await dataProvider.logAccessEntryAudit(entryId, "created");
          } catch {
            // Non-blocking.
          }
        }
        notify("Access saved");
      }
      closeDialog();
      refresh();
      void refetchLegacyCount();
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

  const handleSaveSecret = async () => {
    if (!secretValues.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }

    const valueProvided = secretValues.value.trim().length > 0;
    const payload = {
      label: secretValues.label.trim(),
      secret_label: secretValues.secret_label.trim() || null,
      notes: secretValues.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingSecretId != null) {
        const previous = secrets.find((s) => s.id === editingSecretId) ?? null;
        await updateSecret(
          "deal_secrets",
          {
            id: editingSecretId,
            data: payload,
            previousData: previous ?? { id: editingSecretId },
          },
          { returnPromise: true },
        );
        if (valueProvided) {
          await dataProvider.setDealSecretValue(
            editingSecretId,
            secretValues.value.trim(),
          );
        }
        notify("Secret updated");
      } else {
        const created = await createSecret(
          "deal_secrets",
          {
            data: {
              deal_id: record.id,
              ...payload,
            },
          },
          { returnPromise: true },
        );
        const secretId = created?.id;
        if (secretId != null && valueProvided) {
          await dataProvider.setDealSecretValue(
            secretId,
            secretValues.value.trim(),
          );
        }
        if (secretId != null) {
          try {
            await dataProvider.logDealSecretAudit(secretId, "created");
          } catch {
            // Non-blocking
          }
        }
        notify("Secret created");
      }
      refresh();
      closeSecretDialog();
    } catch {
      notify("Failed to save secret", { type: "error" });
    }
  };

  const handleDeleteSecret = async (secret: DealSecret) => {
    setDeletingSecretId(secret.id);
    try {
      await deleteSecret(
        "deal_secrets",
        { id: secret.id, previousData: secret },
        { returnPromise: true },
      );
      notify("Secret deleted");
      refresh();
    } catch {
      notify("Failed to delete secret", { type: "error" });
    } finally {
      setDeletingSecretId(null);
    }
  };

  const handleDelete = async (entry: DealAccessEntry) => {
    setDeletingId(entry.id);
    try {
      try {
        await dataProvider.logAccessEntryAudit(entry.id, "deleted");
      } catch {
        // Non-blocking.
      }
      await deleteOne(
        "deal_access_entries",
        { id: entry.id, previousData: entry },
        { returnPromise: true },
      );
      notify("Access removed");
      refresh();
      void refetchLegacyCount();
    } catch {
      notify("Failed to remove access", { type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleMigrateLegacy = async () => {
    setIsMigratingLegacy(true);
    try {
      const migrated = await dataProvider.migrateLegacyAccessEntryPasswords();
      notify(
        migrated > 0
          ? `Encrypted ${migrated} legacy credential${migrated === 1 ? "" : "s"}`
          : "No legacy credentials needed migration",
        { type: "success" },
      );
      refresh();
      void refetchLegacyCount();
    } catch {
      notify("Failed to migrate legacy credentials", { type: "error" });
    } finally {
      setIsMigratingLegacy(false);
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

  if (isError || isSecretsError) {
    return (
      <p className="text-sm text-destructive">
        Could not load credentials. Try refreshing the page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {legacyCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>
              {legacyCount} credential{legacyCount === 1 ? "" : "s"} still
              stored in legacy plain-text format. Encrypt them now.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0"
            disabled={isMigratingLegacy}
            onClick={() => void handleMigrateLegacy()}
          >
            {isMigratingLegacy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Encrypt now
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={openCreateSecret}
          className="shrink-0"
        >
          <Plus className="size-4" />
          Add API key
        </Button>
        <Button type="button" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" />
          Add login
        </Button>
      </div>

      {secrets.length === 0 ? null : (
        <div className="overflow-x-auto rounded-md border">
          <div className="border-b bg-muted/20 px-4 py-2 text-sm font-semibold">
            API keys & secrets
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <SecretRow
                  key={String(secret.id)}
                  secret={secret}
                  onEdit={() => openEditSecret(secret)}
                  onDelete={() => void handleDeleteSecret(secret)}
                  isDeleting={isDeletingSecret && deletingSecretId === secret.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
          <div className="border-b bg-muted/20 px-4 py-2 text-sm font-semibold">
            Logins
          </div>
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
        onSave={() => void handleSave()}
        isSaving={isCreating || isUpdating}
        isEditing={Boolean(editingEntry)}
      />

      <SecretDialog
        open={secretDialogOpen}
        title={editingSecretId != null ? "Edit secret" : "Add secret"}
        values={secretValues}
        onChange={setSecretValues}
        onClose={closeSecretDialog}
        onSave={() => void handleSaveSecret()}
        isSaving={isCreatingSecret || isUpdatingSecret}
        isEditing={editingSecretId != null}
      />
    </div>
  );
};
