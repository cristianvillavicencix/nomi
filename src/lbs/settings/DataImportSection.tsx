import { useCallback, useEffect, useState } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { Link } from "react-router";
import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  GitMerge,
  Loader2,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

type ZohoStatus = {
  ok: boolean;
  org_id: number;
  credentials:
    | {
        configured: true;
        region: string;
        api_domain?: string | null;
        scope?: string | null;
        access_token_expires_at?: string | null;
        last_refreshed_at?: string | null;
        created_at?: string | null;
      }
    | { configured: false };
  staging: {
    contacts_raw: { total: number; promoted: number };
    accounts_raw: { total: number; promoted: number };
    deals_raw: { total: number; promoted: number };
  };
};

type ZohoTestResult = {
  ok: boolean;
  api_domain: string;
  total_in_response: number;
  sample: Array<{
    id: string;
    full_name: string;
    email: string | null;
    account: string | null;
  }>;
};

type ZohoSyncResult = {
  ok: boolean;
  modules_synced: string[];
  summary: Record<
    string,
    {
      totalFetched: number;
      totalUpserted: number;
      lastPage: number;
      errors: string[];
    }
  >;
};

type ZohoPromoteResult = {
  ok: boolean;
  dry_run: boolean;
  pending_implementation?: boolean;
  message?: string;
  pending_counts?: {
    accounts_to_promote: number;
    contacts_to_promote: number;
    deals_to_promote: number;
  };
};

type BusyKey =
  | "status"
  | "connect"
  | "test"
  | "sync"
  | "promote-dry"
  | "promote"
  | null;

async function callZohoFn<T>(
  subPath: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  } = {},
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Not signed in. Refresh and try again.");
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !apikey) {
    throw new Error(
      "Supabase environment variables missing (VITE_SUPABASE_URL / VITE_SB_PUBLISHABLE_KEY).",
    );
  }
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/zoho_oneshot_import${subPath}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message)
        : null) ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

const STAGING_LABELS: Record<keyof ZohoStatus["staging"], string> = {
  contacts_raw: "Contacts",
  accounts_raw: "Companies",
  deals_raw: "Deals",
};

export const DataImportSection = () => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [grantToken, setGrantToken] = useState("");
  const [region, setRegion] = useState("com");
  const [testResult, setTestResult] = useState<ZohoTestResult | null>(null);
  const [syncResult, setSyncResult] = useState<ZohoSyncResult | null>(null);
  const [promoteResult, setPromoteResult] = useState<ZohoPromoteResult | null>(
    null,
  );

  const refreshStatus = useCallback(async () => {
    setBusy("status");
    setStatusError(null);
    try {
      const next = await callZohoFn<ZohoStatus>("/");
      setStatus(next);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatusError(message);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void refreshStatus();
  }, [isAdmin, refreshStatus]);

  if (!isAdmin) {
    return (
      <div className="space-y-4 max-w-3xl">
        <h2 className="text-lg font-semibold">Data Import</h2>
        <p className="text-sm text-muted-foreground">
          Only administrators can configure the data import.
        </p>
      </div>
    );
  }

  const handleConnect = async () => {
    const trimmed = grantToken.trim();
    if (!trimmed) {
      notify("Paste the Zoho Grant Token first", { type: "error" });
      return;
    }
    setBusy("connect");
    try {
      await callZohoFn("/setup-credentials", {
        method: "POST",
        body: { grant_token: trimmed, region },
      });
      setGrantToken("");
      notify("Connected to Zoho", { type: "success" });
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy("test");
    setTestResult(null);
    try {
      const r = await callZohoFn<ZohoTestResult>("/test-connection", {
        method: "POST",
      });
      setTestResult(r);
      notify(`Pulled ${r.total_in_response} sample contacts from Zoho`, {
        type: "success",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    if (!window.confirm("Pull ALL Contacts, Accounts and Deals from Zoho into staging tables. This may take a few minutes for large CRMs. Continue?")) {
      return;
    }
    setBusy("sync");
    setSyncResult(null);
    try {
      const r = await callZohoFn<ZohoSyncResult>("/sync-all", {
        method: "POST",
        body: {},
      });
      setSyncResult(r);
      notify("Zoho sync complete", { type: "success" });
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
    } finally {
      setBusy(null);
    }
  };

  const handlePromote = async (dryRun: boolean) => {
    if (!dryRun) {
      if (
        !window.confirm(
          "Promote staged Zoho records into Companies, Contacts and Deals. This is destructive on duplicates. Continue?",
        )
      ) {
        return;
      }
    }
    setBusy(dryRun ? "promote-dry" : "promote");
    setPromoteResult(null);
    try {
      const r = await callZohoFn<ZohoPromoteResult>("/promote", {
        method: "POST",
        body: { dry_run: dryRun },
      });
      setPromoteResult(r);
      if (r.pending_implementation) {
        notify(
          "Promotion endpoint is not wired yet — staging only. Coming next.",
          { type: "warning", multiLine: true },
        );
      } else {
        notify(dryRun ? "Dry-run complete" : "Promotion complete", {
          type: "success",
        });
      }
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
    } finally {
      setBusy(null);
    }
  };

  const isConnected =
    status?.credentials.configured === true ? true : false;
  const stagingTotal =
    (status?.staging.contacts_raw.total ?? 0) +
    (status?.staging.accounts_raw.total ?? 0) +
    (status?.staging.deals_raw.total ?? 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">Data Import</h2>
        <p className="text-sm text-muted-foreground">
          Bring contacts, companies and deals into the CRM from Zoho CRM or a
          CSV file. Then deduplicate any repeated records.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" /> Import from Zoho CRM
              </CardTitle>
              <CardDescription>
                One-shot import. Connect once with a Zoho Grant Token, then
                sync every Contact, Account and Deal into staging — and finally
                promote into your CRM.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={busy !== null}
              aria-label="Refresh status"
            >
              {busy === "status" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {statusError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {statusError}
            </div>
          ) : null}

          {status == null && !statusError ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Zoho status…
            </p>
          ) : null}

          {status != null && !isConnected ? (
            <ConnectForm
              grantToken={grantToken}
              setGrantToken={setGrantToken}
              region={region}
              setRegion={setRegion}
              onConnect={handleConnect}
              busy={busy === "connect"}
              disabled={busy !== null && busy !== "connect"}
            />
          ) : null}

          {status != null && isConnected ? (
            <ConnectedPanel
              status={status}
              busy={busy}
              stagingTotal={stagingTotal}
              onTest={handleTest}
              onSync={handleSync}
              onPromote={handlePromote}
              testResult={testResult}
              syncResult={syncResult}
              promoteResult={promoteResult}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Import from CSV
          </CardTitle>
          <CardDescription>
            Upload CSV files for contacts, companies or projects. The unified
            CSV importer is on the way — until then, use the per-module Import
            inside Contacts and Companies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coming in a follow-up release.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" /> Find duplicates
          </CardTitle>
          <CardDescription>
            After importing, this tool finds candidate duplicate contacts
            (same email, phone, or name) so you can merge them manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/clients/find-duplicates">Open duplicate finder</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const ConnectForm = ({
  grantToken,
  setGrantToken,
  region,
  setRegion,
  onConnect,
  busy,
  disabled,
}: {
  grantToken: string;
  setGrantToken: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  onConnect: () => void;
  busy: boolean;
  disabled: boolean;
}) => (
  <div className="space-y-4">
    <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
      <p className="font-medium">Generate a Grant Token from Zoho first:</p>
      <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
        <li>
          Open{" "}
          <a
            href="https://api-console.zoho.com"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline inline-flex items-center gap-1"
          >
            Zoho API Console <ExternalLink className="h-3 w-3" />
          </a>
        </li>
        <li>Select your Self Client application</li>
        <li>
          Use scope{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            ZohoCRM.modules.ALL,ZohoCRM.org.READ,ZohoCRM.users.READ
          </code>
        </li>
        <li>Time duration: 10 minutes</li>
        <li>Copy the generated code and paste it here within 10 minutes</li>
      </ol>
    </div>

    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
      <div className="space-y-1.5">
        <Label htmlFor="zoho-grant-token">Grant Token</Label>
        <Input
          id="zoho-grant-token"
          value={grantToken}
          onChange={(e) => setGrantToken(e.target.value)}
          placeholder="1000.xxxxxxxxxxxxxxxx"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="zoho-region">Region</Label>
        <select
          id="zoho-region"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="com">.com (USA)</option>
          <option value="eu">.eu</option>
          <option value="in">.in</option>
          <option value="au">.com.au</option>
          <option value="jp">.jp</option>
          <option value="ca">.ca</option>
        </select>
      </div>
    </div>

    <Button
      type="button"
      onClick={onConnect}
      disabled={busy || disabled || !grantToken.trim()}
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting…
        </>
      ) : (
        "Connect to Zoho"
      )}
    </Button>
  </div>
);

const ConnectedPanel = ({
  status,
  busy,
  stagingTotal,
  onTest,
  onSync,
  onPromote,
  testResult,
  syncResult,
  promoteResult,
}: {
  status: ZohoStatus;
  busy: BusyKey;
  stagingTotal: number;
  onTest: () => void;
  onSync: () => void;
  onPromote: (dryRun: boolean) => void;
  testResult: ZohoTestResult | null;
  syncResult: ZohoSyncResult | null;
  promoteResult: ZohoPromoteResult | null;
}) => {
  if (status.credentials.configured !== true) return null;
  const creds = status.credentials;

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "—";

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3 text-sm space-y-1">
        <p className="font-medium flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> Connected to Zoho
        </p>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
          <dt>Region</dt>
          <dd>
            <code className="rounded bg-muted px-1">{creds.region}</code>
          </dd>
          <dt>API domain</dt>
          <dd className="truncate">{creds.api_domain ?? "—"}</dd>
          <dt>Scope</dt>
          <dd className="truncate break-all">{creds.scope ?? "—"}</dd>
          <dt>Last refresh</dt>
          <dd>{formatDate(creds.last_refreshed_at)}</dd>
          <dt>Token expires</dt>
          <dd>{formatDate(creds.access_token_expires_at)}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(STAGING_LABELS) as Array<keyof typeof STAGING_LABELS>).map(
          (key) => (
            <StagingStat
              key={key}
              label={STAGING_LABELS[key]}
              total={status.staging[key].total}
              promoted={status.staging[key].promoted}
            />
          ),
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={busy !== null}
        >
          {busy === "test" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Test connection
        </Button>
        <Button type="button" onClick={onSync} disabled={busy !== null}>
          {busy === "sync" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Sync everything from Zoho
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onPromote(true)}
          disabled={busy !== null || stagingTotal === 0}
        >
          {busy === "promote-dry" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Dry-run promote
        </Button>
        <Button
          type="button"
          onClick={() => onPromote(false)}
          disabled={busy !== null || stagingTotal === 0}
        >
          {busy === "promote" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Promote to CRM
        </Button>
      </div>

      {testResult ? (
        <details className="rounded-md border p-3 text-xs">
          <summary className="font-medium cursor-pointer">
            Test connection: {testResult.total_in_response} sample contacts
          </summary>
          <ul className="mt-2 space-y-1">
            {testResult.sample.map((c) => (
              <li key={c.id} className="truncate text-muted-foreground">
                <span className="font-medium text-foreground">
                  {c.full_name || "(no name)"}
                </span>
                {c.email ? ` · ${c.email}` : ""}
                {c.account ? ` · ${c.account}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {syncResult ? (
        <details className="rounded-md border p-3 text-xs" open>
          <summary className="font-medium cursor-pointer">
            Last sync · modules: {syncResult.modules_synced.join(", ")}
          </summary>
          <div className="mt-2 space-y-2">
            {Object.entries(syncResult.summary).map(([mod, info]) => (
              <div key={mod} className="grid grid-cols-[6rem_1fr] gap-2">
                <span className="font-medium">{mod}</span>
                <span className="text-muted-foreground">
                  fetched <code>{info.totalFetched}</code> · upserted{" "}
                  <code>{info.totalUpserted}</code> · pages{" "}
                  <code>{info.lastPage}</code>
                  {info.errors.length > 0 ? (
                    <span className="text-destructive">
                      {" "}· errors: {info.errors.length}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {promoteResult ? (
        <details className="rounded-md border p-3 text-xs" open>
          <summary className="font-medium cursor-pointer">
            Promote {promoteResult.dry_run ? "(dry-run)" : ""}
          </summary>
          {promoteResult.message ? (
            <p className="mt-2 text-muted-foreground">
              {promoteResult.message}
            </p>
          ) : null}
          {promoteResult.pending_counts ? (
            <ul className="mt-2 text-muted-foreground space-y-0.5">
              <li>
                Accounts pending:{" "}
                <code>{promoteResult.pending_counts.accounts_to_promote}</code>
              </li>
              <li>
                Contacts pending:{" "}
                <code>{promoteResult.pending_counts.contacts_to_promote}</code>
              </li>
              <li>
                Deals pending:{" "}
                <code>{promoteResult.pending_counts.deals_to_promote}</code>
              </li>
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
};

const StagingStat = ({
  label,
  total,
  promoted,
}: {
  label: string;
  total: number;
  promoted: number;
}) => (
  <div className="rounded-md border p-3">
    <p className="text-xs uppercase text-muted-foreground tracking-wide">
      {label}
    </p>
    <p className="text-2xl font-semibold tabular-nums">{total}</p>
    <p className="text-xs text-muted-foreground">
      {promoted} already promoted
    </p>
  </div>
);
