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
import { Input } from "@/components/ui/input";
import {
  normalizeAccessUrl,
} from "@/lbs/deals/projectAccessConstants";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/lbs/deals/supabaseSchemaErrors";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { DealAccessEntry, DealSecret, LbsDeal } from "@/lbs/types";

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
    if (entry.username?.trim()) {
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
        lines.push(`Password: ${password.trim()}`);
      }
    }
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

const AccessEntryEditRow = ({
  entry,
  values,
  onChange,
  onCancel,
  onSave,
  isSaving,
}: {
  entry: DealAccessEntry;
  values: { label: string; url: string; username: string; password: string };
  onChange: (next: { label: string; url: string; username: string; password: string }) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <TableRow>
    <TableCell className="font-medium whitespace-nowrap">
      <Input
        value={values.label}
        onChange={(e) => onChange({ ...values, label: e.target.value })}
        placeholder="Label"
      />
    </TableCell>
    <TableCell className="max-w-[220px]">
      <Input
        value={values.url}
        onChange={(e) => onChange({ ...values, url: e.target.value })}
        placeholder="Login URL"
      />
    </TableCell>
    <TableCell className="max-w-[160px]">
      <Input
        value={values.username}
        onChange={(e) => onChange({ ...values, username: e.target.value })}
        placeholder="Username"
      />
    </TableCell>
    <TableCell className="max-w-[180px]">
      <Input
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(e) => onChange({ ...values, password: e.target.value })}
        placeholder="(optional) new password"
      />
    </TableCell>
    <TableCell className="text-right">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
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
      </div>
    </TableCell>
  </TableRow>
);

const AccessEntryCreateRow = ({
  values,
  onChange,
  onSave,
  isSaving,
}: {
  values: { label: string; url: string; username: string; password: string };
  onChange: (next: { label: string; url: string; username: string; password: string }) => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <TableRow className="bg-muted/10">
    <TableCell className="font-medium whitespace-nowrap">
      <Input
        value={values.label}
        onChange={(e) => onChange({ ...values, label: e.target.value })}
        placeholder="Label"
      />
    </TableCell>
    <TableCell className="max-w-[220px]">
      <Input
        value={values.url}
        onChange={(e) => onChange({ ...values, url: e.target.value })}
        placeholder="Login URL"
      />
    </TableCell>
    <TableCell className="max-w-[160px]">
      <Input
        value={values.username}
        onChange={(e) => onChange({ ...values, username: e.target.value })}
        placeholder="Username"
      />
    </TableCell>
    <TableCell className="max-w-[180px]">
      <Input
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(e) => onChange({ ...values, password: e.target.value })}
        placeholder="Password"
      />
    </TableCell>
    <TableCell className="text-right">
      <Button
        type="button"
        onClick={onSave}
        disabled={isSaving || !values.label.trim()}
      >
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </TableCell>
  </TableRow>
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

const SecretEditRow = ({
  secret,
  values,
  onChange,
  onCancel,
  onSave,
  isSaving,
}: {
  secret: DealSecret;
  values: { label: string; value: string };
  onChange: (next: { label: string; value: string }) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <TableRow>
    <TableCell className="font-medium whitespace-nowrap">
      <Input
        value={values.label}
        onChange={(e) => onChange({ ...values, label: e.target.value })}
        placeholder="Label"
      />
    </TableCell>
    <TableCell className="max-w-[240px]">
      <Input
        type="password"
        autoComplete="new-password"
        value={values.value}
        onChange={(e) => onChange({ ...values, value: e.target.value })}
        placeholder="(optional) new API key"
      />
    </TableCell>
    <TableCell className="w-[88px] text-right">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
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
      </div>
    </TableCell>
  </TableRow>
);

const SecretCreateRow = ({
  values,
  onChange,
  onSave,
  isSaving,
}: {
  values: { label: string; value: string };
  onChange: (next: { label: string; value: string }) => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <TableRow className="bg-muted/10">
    <TableCell className="font-medium whitespace-nowrap">
      <Input
        value={values.label}
        onChange={(e) => onChange({ ...values, label: e.target.value })}
        placeholder="Label"
      />
    </TableCell>
    <TableCell className="max-w-[240px]">
      <Input
        type="password"
        autoComplete="new-password"
        value={values.value}
        onChange={(e) => onChange({ ...values, value: e.target.value })}
        placeholder="API key"
      />
    </TableCell>
    <TableCell className="w-[88px] text-right">
      <Button
        type="button"
        onClick={onSave}
        disabled={isSaving || !values.label.trim()}
      >
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </TableCell>
  </TableRow>
);

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
  const [editingId, setEditingId] = useState<Identifier | null>(null);
  const [editValues, setEditValues] = useState<{
    label: string;
    url: string;
    username: string;
    password: string;
  }>({ label: "", url: "", username: "", password: "" });
  const [newValues, setNewValues] = useState<{
    label: string;
    url: string;
    username: string;
    password: string;
  }>({ label: "", url: "", username: "", password: "" });

  const [editingSecretId, setEditingSecretId] = useState<Identifier | null>(null);
  const [editSecretValues, setEditSecretValues] = useState<{ label: string; value: string }>({
    label: "",
    value: "",
  });
  const [newSecretValues, setNewSecretValues] = useState<{ label: string; value: string }>(() =>
    emptySecretFormValues(),
  );
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

  const startEdit = (entry: DealAccessEntry) => {
    setEditingId(entry.id);
    setEditValues({
      label: entry.label ?? "",
      url: entry.url ?? "",
      username: entry.username ?? "",
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ label: "", url: "", username: "", password: "" });
  };

  const saveEdit = async () => {
    if (editingEntry == null) return;
    if (!editValues.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }
    const passwordProvided = editValues.password.trim().length > 0;
    const payload = {
      label: editValues.label.trim(),
      url: editValues.url.trim() || null,
      username: editValues.username.trim() || null,
      kind: "login",
      secret_label: null,
      notes: null,
      updated_at: new Date().toISOString(),
    };
    try {
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
          editValues.password.trim(),
        );
      }
      notify("Access updated");
      cancelEdit();
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

  const saveNew = async () => {
    if (!newValues.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }
    const passwordProvided = newValues.password.trim().length > 0;
    const payload = {
      label: newValues.label.trim(),
      url: newValues.url.trim() || null,
      username: newValues.username.trim() || null,
      kind: "login",
      secret_label: null,
      notes: null,
      updated_at: new Date().toISOString(),
    };
    try {
      const created = await create(
        "deal_access_entries",
        { data: { deal_id: record.id, ...payload } },
        { returnPromise: true },
      );
      const entryId = created?.id;
      if (entryId != null && passwordProvided) {
        await dataProvider.setAccessEntryPassword(
          entryId,
          newValues.password.trim(),
        );
      }
      if (entryId != null) {
        try {
          await dataProvider.logAccessEntryAudit(entryId, "created");
        } catch {
          // Non-blocking
        }
      }
      setNewValues({ label: "", url: "", username: "", password: "" });
      notify("Access saved");
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

  const startEditSecret = (secret: DealSecret) => {
    setEditingSecretId(secret.id);
    setEditSecretValues({ label: secret.label ?? "", value: "" });
  };

  const cancelEditSecret = () => {
    setEditingSecretId(null);
    setEditSecretValues({ label: "", value: "" });
  };

  const saveEditSecret = async () => {
    if (editingSecretId == null) return;
    const secret = secrets.find((s) => s.id === editingSecretId) ?? null;
    if (!editSecretValues.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }
    const valueProvided = editSecretValues.value.trim().length > 0;
    const payload = {
      label: editSecretValues.label.trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      await updateSecret(
        "deal_secrets",
        {
          id: editingSecretId,
          data: payload,
          previousData: secret ?? { id: editingSecretId },
        },
        { returnPromise: true },
      );
      if (valueProvided) {
        await dataProvider.setDealSecretValue(
          editingSecretId,
          editSecretValues.value.trim(),
        );
      }
      notify("Secret updated");
      cancelEditSecret();
      refresh();
    } catch {
      notify("Failed to save secret", { type: "error" });
    }
  };

  const saveNewSecret = async () => {
    if (!newSecretValues.label.trim()) {
      notify("Label is required", { type: "error" });
      return;
    }
    const valueProvided = newSecretValues.value.trim().length > 0;
    const payload = {
      label: newSecretValues.label.trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      const created = await createSecret(
        "deal_secrets",
        { data: { deal_id: record.id, ...payload } },
        { returnPromise: true },
      );
      const secretId = created?.id;
      if (secretId != null && valueProvided) {
        await dataProvider.setDealSecretValue(
          secretId,
          newSecretValues.value.trim(),
        );
      }
      if (secretId != null) {
        try {
          await dataProvider.logDealSecretAudit(secretId, "created");
        } catch {
          // Non-blocking
        }
      }
      setNewSecretValues(emptySecretFormValues());
      notify("Secret created");
      refresh();
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
            {secrets.map((secret) =>
              editingSecretId === secret.id ? (
                <SecretEditRow
                  key={String(secret.id)}
                  secret={secret}
                  values={editSecretValues}
                  onChange={setEditSecretValues}
                  onCancel={cancelEditSecret}
                  onSave={() => void saveEditSecret()}
                  isSaving={isUpdatingSecret}
                />
              ) : (
                <SecretRow
                  key={String(secret.id)}
                  secret={secret}
                  onEdit={() => startEditSecret(secret)}
                  onDelete={() => void handleDeleteSecret(secret)}
                  isDeleting={isDeletingSecret && deletingSecretId === secret.id}
                />
              ),
            )}
            <SecretCreateRow
              values={newSecretValues}
              onChange={setNewSecretValues}
              onSave={() => void saveNewSecret()}
              isSaving={isCreatingSecret}
            />
          </TableBody>
        </Table>
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
              {entries.map((entry) =>
                editingId === entry.id ? (
                  <AccessEntryEditRow
                    key={String(entry.id)}
                    entry={entry}
                    values={editValues}
                    onChange={setEditValues}
                    onCancel={cancelEdit}
                    onSave={() => void saveEdit()}
                    isSaving={isUpdating}
                  />
                ) : (
                  <AccessEntryRow
                    key={String(entry.id)}
                    entry={entry}
                    onEdit={() => startEdit(entry)}
                    onDelete={() => handleDelete(entry)}
                    isDeleting={isDeleting && deletingId === entry.id}
                  />
                ),
              )}
              <AccessEntryCreateRow
                values={newValues}
                onChange={setNewValues}
                onSave={() => void saveNew()}
                isSaving={isCreating}
              />
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
