import { useMemo, useState } from "react";
import {
  useDataProvider,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  Upload,
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
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  isLikelySecretEnvKey,
  parseEnvText,
  serializeEnvVars,
} from "@/modules/deals/envVarParse";
import {
  SecurityFloatingInput,
  SecurityFloatingTextarea,
} from "@/modules/deals/projects/securityFloatingFields";
import {
  getSupabaseSchemaMissingMessage,
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/modules/deals/supabaseSchemaErrors";
import type { DealEnvVar, LbsDeal } from "@/modules/types";

const copyText = async (
  value: string,
  notify: ReturnType<typeof useNotify>,
) => {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  notify("Copied to clipboard", { type: "info" });
};

const EnvVarRow = ({
  row,
  canManage,
  onDeleted,
}: {
  row: DealEnvVar;
  canManage: boolean;
  onDeleted: () => void;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [deleteOne] = useDelete();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasValue = row.has_value === true;
  const isSecret = row.is_secret !== false;

  const reveal = async () => {
    if (revealed != null) {
      setShow(true);
      return;
    }
    setBusy(true);
    try {
      const value = await dataProvider.getDealEnvVarValue(row.id);
      setRevealed(value);
      setShow(Boolean(value));
      if (!value) notify("No value stored", { type: "warning" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to reveal value",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    let value = revealed;
    if (value == null && hasValue) {
      setBusy(true);
      try {
        value = await dataProvider.getDealEnvVarValue(row.id);
        setRevealed(value);
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Failed to copy value",
          { type: "error" },
        );
        return;
      } finally {
        setBusy(false);
      }
    }
    if (!value) return;
    await copyText(value, notify);
  };

  const remove = async () => {
    if (!canManage) return;
    if (!window.confirm(`Delete ${row.key}?`)) return;
    setBusy(true);
    try {
      await deleteOne(
        "deal_env_vars",
        { id: row.id, previousData: row },
        { returnPromise: true },
      );
      notify("Variable deleted");
      onDeleted();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to delete variable",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-medium whitespace-nowrap">
        {row.key}
      </TableCell>
      <TableCell className="max-w-[280px]">
        {hasValue ? (
          <div className="flex items-center gap-1">
            <code className="truncate text-xs">
              {show && revealed != null
                ? revealed
                : isSecret
                  ? "••••••••"
                  : "••••••••"}
            </code>
            <IconButton
              className="size-7 shrink-0"
              disabled={busy}
              aria-label={show ? "Hide value" : "Reveal value"}
              onClick={() => (show ? setShow(false) : void reveal())}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : show ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </IconButton>
            <IconButton
              className="size-7 shrink-0"
              disabled={busy}
              aria-label="Copy value"
              onClick={() => void copy()}
            >
              <Copy className="size-3.5" />
            </IconButton>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-[56px] text-right">
        <IconButton
          aria-label="Delete variable"
          className="text-destructive"
          disabled={!canManage || busy}
          onClick={() => void remove()}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

export const ProjectEnvVarsCard = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const canManage = useMemberCapability("deal_operations.credentials.manage");
  const [pasteText, setPasteText] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyAllBusy, setCopyAllBusy] = useState(false);

  const { data: rows = [], error, isPending } = useGetList<DealEnvVar>(
    "deal_env_vars",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { ...supabaseTableQueryOptions("deal_env_vars") },
  );

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        String(a.key).localeCompare(String(b.key), undefined, {
          sensitivity: "base",
        }),
      ),
    [rows],
  );

  if (isSupabaseSchemaMissingError(error, "deal_env_vars")) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {getSupabaseSchemaMissingMessage("deal_env_vars")}
      </div>
    );
  }

  const applyPaste = async () => {
    if (!canManage) return;
    const parsed = parseEnvText(pasteText);
    if (parsed.length === 0) {
      notify("No valid KEY=value lines found", { type: "warning" });
      return;
    }
    setBusy(true);
    try {
      await dataProvider.setDealEnvVarsMany(
        record.id,
        parsed.map((entry, index) => ({
          key: entry.key,
          value: entry.value,
          is_secret: isLikelySecretEnvKey(entry.key),
          sort_order: index,
        })),
      );
      notify(`Saved ${parsed.length} environment variable(s)`);
      setPasteText("");
      refresh();
    } catch (applyError) {
      notify(
        applyError instanceof Error
          ? applyError.message
          : "Failed to save environment variables",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  const addRow = async () => {
    if (!canManage) return;
    const key = newKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      notify("Use a valid env key (e.g. DB_HOST)", { type: "warning" });
      return;
    }
    setBusy(true);
    try {
      await dataProvider.setDealEnvVarsMany(record.id, [
        {
          key,
          value: newValue,
          is_secret: isLikelySecretEnvKey(key),
          sort_order: rows.length,
        },
      ]);
      setNewKey("");
      setNewValue("");
      notify("Variable saved");
      refresh();
    } catch (addError) {
      notify(
        addError instanceof Error ? addError.message : "Failed to add variable",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (sorted.length === 0) return;
    setCopyAllBusy(true);
    try {
      const pairs: Array<{ key: string; value: string }> = [];
      for (const row of sorted) {
        if (!row.has_value) {
          pairs.push({ key: row.key, value: "" });
          continue;
        }
        const value = await dataProvider.getDealEnvVarValue(row.id);
        pairs.push({ key: row.key, value: value ?? "" });
      }
      await copyText(serializeEnvVars(pairs), notify);
    } catch (copyError) {
      notify(
        copyError instanceof Error
          ? copyError.message
          : "Failed to copy environment file",
        { type: "error" },
      );
    } finally {
      setCopyAllBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Environment variables</h3>
        {sorted.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={copyAllBusy}
            onClick={() => void copyAll()}
          >
            {copyAllBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Copy className="size-4" />
            )}
            Copy all as .env
          </Button>
        ) : null}
      </div>
      <div className="space-y-4">
        {canManage ? (
          <div className="space-y-3">
            <SecurityFloatingTextarea
              id="env-paste"
              label="Paste .env"
              rows={6}
              value={pasteText}
              placeholder={"APP_NAME=...\nDB_HOST=...\nDB_PASS=..."}
              className="[&_textarea]:font-mono [&_textarea]:text-xs"
              onChange={setPasteText}
            />
            <Button
              type="button"
              disabled={busy || !pasteText.trim()}
              onClick={() => void applyPaste()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import &amp; save
            </Button>
          </div>
        ) : null}

        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
            <SecurityFloatingInput
              id="env-new-key"
              label="Key"
              value={newKey}
              placeholder="DB_HOST"
              className="[&_input]:font-mono [&_input]:text-xs"
              onChange={setNewKey}
            />
            <SecurityFloatingInput
              id="env-new-value"
              label="Value"
              value={newValue}
              placeholder="value"
              className="[&_input]:font-mono [&_input]:text-xs"
              onChange={setNewValue}
            />
            <Button
              type="button"
              className="h-9"
              disabled={busy || !newKey.trim()}
              onClick={() => void addRow()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        ) : null}

        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No environment variables yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[56px] text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <EnvVarRow
                    key={String(row.id)}
                    row={row}
                    canManage={canManage}
                    onDeleted={() => refresh()}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
