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
  Link2,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  emptyDealAccessFormValues,
  emptyDealAccessLinkFormValues,
  normalizeAccessUrl,
  type DealAccessFormValues,
} from "@/modules/deals/projectAccessConstants";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/modules/deals/supabaseSchemaErrors";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { DealAccessEntry, DealSecret, LbsDeal } from "@/modules/types";

const inferKindFromEntry = (entry: DealAccessEntry) => {
  if (entry.kind) return String(entry.kind);
  const label = String(entry.label ?? "").toLowerCase();
  if (label.includes("api key")) return "api_key";
  return "login";
};

const emptySecretFormValues = () => ({
  label: "",
  value: "",
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
        <div>{entry.label}</div>
        {entry.notes?.trim() ? (
          <p className="mt-1 max-w-[240px] text-xs font-normal text-muted-foreground whitespace-normal">
            {entry.notes.trim()}
          </p>
        ) : null}
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
            <IconButton
              className="size-7 shrink-0"
              onClick={() => copyToClipboard(entry.username ?? "", notify)}
              aria-label="Copy username"
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy username</span>
            </IconButton>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-[180px]">
        {hasPassword ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {showPassword && revealedPassword ? revealedPassword : "••••••••"}
            </code>
            <IconButton
              className="size-7 shrink-0"
              disabled={isRevealing}
              aria-label={showPassword ? "Hide password" : "Reveal password"}
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
            </IconButton>
            <IconButton
              className="size-7 shrink-0"
              disabled={isRevealing}
              onClick={() => void copyPassword()}
              aria-label="Copy password"
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy password</span>
            </IconButton>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <IconButton
            onClick={() => void copyAll()}
            aria-label="Copy all"
            title="Copy all credentials"
          >
            <Copy className="size-4" />
            <span className="sr-only">Copy all</span>
          </IconButton>
          <IconButton onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
            <span className="sr-only">Edit</span>
          </IconButton>
          <IconButton
            className="text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="sr-only">Delete</span>
          </IconButton>
        </div>
      </TableCell>
    </TableRow>
  );
};

const LinkAccessEntryRow = ({
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
  const href = normalizeAccessUrl(entry.url);

  const copyLinkDetails = async () => {
    const lines = [`Label: ${entry.label}`];
    if (entry.url?.trim()) lines.push(`URL: ${entry.url.trim()}`);
    if (entry.notes?.trim()) lines.push(`Notes: ${entry.notes.trim()}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    notify("Link copied", { type: "info" });
  };

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">
        <div>{entry.label}</div>
        {entry.notes?.trim() ? (
          <p className="mt-1 max-w-[280px] text-xs font-normal text-muted-foreground whitespace-normal">
            {entry.notes.trim()}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="max-w-[320px]">
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
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {href ? (
            <IconButton
              onClick={() => void copyToClipboard(entry.url ?? "", notify)}
              aria-label="Copy URL"
              title="Copy URL"
            >
              <Copy className="size-4" />
              <span className="sr-only">Copy URL</span>
            </IconButton>
          ) : null}
          <IconButton
            onClick={() => void copyLinkDetails()}
            aria-label="Copy link details"
            title="Copy link details"
          >
            <Link2 className="size-4" />
            <span className="sr-only">Copy link details</span>
          </IconButton>
          <IconButton onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
            <span className="sr-only">Edit</span>
          </IconButton>
          <IconButton
            className="text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="sr-only">Delete</span>
          </IconButton>
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
  const isLink = values.kind === "link";
  const canSave =
    values.label.trim().length > 0 && (!isLink || values.url.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="access-label">Label</Label>
            <Input
              id="access-label"
              value={values.label}
              onChange={(event) =>
                onChange({ ...values, label: event.target.value })
              }
              placeholder={
                isLink
                  ? "Google Business Profile, Review link, Facebook page…"
                  : "Custom label, e.g. Shopify admin"
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-url">
              {isLink ? "Link URL" : "Login URL"}
            </Label>
            <Input
              id="access-url"
              value={values.url}
              onChange={(event) =>
                onChange({ ...values, url: event.target.value })
              }
              placeholder={
                isLink
                  ? "https://g.page/your-business or https://facebook.com/…"
                  : "https://example.com/wp-admin"
              }
            />
          </div>
          {isLink ? null : (
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
                    isEditing ? "Leave blank to keep unchanged" : "Optional"
                  }
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="access-notes">Instructions for client</Label>
            <Textarea
              id="access-notes"
              value={values.notes}
              onChange={(event) =>
                onChange({ ...values, notes: event.target.value })
              }
              placeholder={
                isLink
                  ? "e.g. Use this link to manage your Google Business Profile or collect reviews."
                  : "e.g. Sign in with Google using this email. LBS does not store your Google password."
              }
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {isLink
                ? "Optional. Shown in the client portal when this link is shared at delivery."
                : "Shown in the client portal when this credential is shared at delivery. Leave password empty for Google or client-owned logins."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !canSave}
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
  values: { label: string; value: string };
  onChange: (values: { label: string; value: string }) => void;
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
            onChange={(event) =>
              onChange({ ...values, label: event.target.value })
            }
            placeholder="Place API key"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret-value">API key</Label>
          <Input
            id="secret-value"
            type="password"
            autoComplete="new-password"
            value={values.value}
            onChange={(event) =>
              onChange({ ...values, value: event.target.value })
            }
            placeholder={
              isEditing ? "Leave blank to keep unchanged" : "Paste value"
            }
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
      <TableCell className="font-medium whitespace-nowrap">
        {secret.label}
      </TableCell>
      <TableCell className="max-w-[240px]">
        {hasSecret ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {show && revealed ? revealed : "••••••••"}
            </code>
            <IconButton
              aria-label="Loading"
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
            </IconButton>
            <IconButton
              className="size-7 shrink-0"
              onClick={() => void copy()}
              aria-label="Copy secret"
              disabled={isRevealing}
            >
              <Copy className="size-3.5" />
              <span className="sr-only">Copy secret</span>
            </IconButton>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-[88px] text-right">
        <div className="flex justify-end gap-1">
          <IconButton onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
            <span className="sr-only">Edit</span>
          </IconButton>
          <IconButton
            className="text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="sr-only">Delete</span>
          </IconButton>
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
  const [editingSecretId, setEditingSecretId] = useState<Identifier | null>(
    null,
  );
  const [secretValues, setSecretValues] = useState(() =>
    emptySecretFormValues(),
  );
  const [deletingId, setDeletingId] = useState<Identifier | null>(null);
  const [deletingSecretId, setDeletingSecretId] = useState<Identifier | null>(
    null,
  );
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

  const linkEntries = useMemo(
    () => entries.filter((entry) => entry.kind === "link"),
    [entries],
  );

  const loginEntries = useMemo(
    () => entries.filter((entry) => entry.kind !== "link"),
    [entries],
  );

  const accessDialogTitle = useMemo(() => {
    if (values.kind === "link") {
      return editingEntry ? "Edit link" : "Add link";
    }
    return editingEntry ? "Edit access" : "Add login";
  }, [editingEntry, values.kind]);

  const openCreate = () => {
    setEditingId(null);
    setValues(emptyDealAccessFormValues());
    setDialogOpen(true);
  };

  const openCreateLink = () => {
    setEditingId(null);
    setValues(emptyDealAccessLinkFormValues());
    setDialogOpen(true);
  };

  const openCreateSecret = () => {
    setEditingSecretId(null);
    setSecretValues(emptySecretFormValues());
    setSecretDialogOpen(true);
  };

  const openEdit = (entry: DealAccessEntry) => {
    setEditingId(entry.id);
    setValues({
      label: entry.label ?? "",
      kind:
        entry.kind === "api_key" ||
        entry.kind === "link" ||
        entry.kind === "note"
          ? entry.kind
          : "login",
      secret_label: entry.secret_label ?? "Password",
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
      value: "",
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

    if (values.kind === "link" && !values.url.trim()) {
      notify("Link URL is required", { type: "error" });
      return;
    }

    const passwordProvided = values.password.trim().length > 0;
    const payload = {
      label: values.label.trim(),
      url: values.url.trim() || null,
      username:
        values.kind === "link" ? null : values.username.trim() || null,
      kind: values.kind,
      secret_label: values.secret_label.trim() || null,
      notes: values.notes.trim() || null,
      shared_with_client: true,
      managed_by: "lbs",
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
        notify(values.kind === "link" ? "Link updated" : "Access updated");
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
        notify(values.kind === "link" ? "Link saved" : "Access saved");
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
      shared_with_client: true,
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
      <div className="rounded-lg border border-dashed border-warning/40 bg-warning/10 p-6">
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
          variant="secondary"
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
        <Button
          type="button"
          variant="outline"
          onClick={openCreateLink}
          className="shrink-0"
        >
          <Link2 className="size-4" />
          Add link
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
                  isDeleting={
                    isDeletingSecret && deletingSecretId === secret.id
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {linkEntries.length === 0 ? null : (
        <div className="overflow-x-auto rounded-md border">
          <div className="border-b bg-muted/20 px-4 py-2 text-sm font-semibold">
            Links
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkEntries.map((entry) => (
                <LinkAccessEntryRow
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

      {loginEntries.length === 0 && linkEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <KeyRound className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No access entries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add logins for hosting and WordPress, or links for Google Business
            Profile, review pages, and social profiles.
          </p>
        </div>
      ) : loginEntries.length === 0 ? null : (
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
              {loginEntries.map((entry) => (
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
        title={accessDialogTitle}
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
