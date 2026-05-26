import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { Link, useSearchParams } from "react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Database,
  Download,
  ExternalLink,
  GitMerge,
  Loader2,
  LogIn,
  LogOut,
  RefreshCcw,
  User,
  Briefcase,
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

type ModuleKey = "Accounts" | "Contacts" | "Deals";

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

type SyncResult = {
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

type PromoteResult = {
  ok: boolean;
  dry_run: boolean;
  modules: ModuleKey[];
  summary: Record<
    ModuleKey,
    {
      inserted: number;
      updated: number;
      skipped: number;
      errors: string[];
    }
  >;
};

type ActivityEntry = {
  at: number;
  text: string;
  tone: "info" | "success" | "error";
};

async function callZoho<T>(
  subPath: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in. Refresh the page.");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !apikey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / VITE_SB_PUBLISHABLE_KEY in environment.",
    );
  }
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/zoho_oneshot_import${subPath}`,
    {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  );
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  if (!res.ok) {
    const message =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return parsed as T;
}

const MODULE_CONFIG: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  icon: typeof Building2;
  stagingField: keyof ZohoStatus["staging"];
}> = [
  {
    key: "Accounts",
    label: "Companies",
    description: "Imported first — companies are referenced by contacts and deals.",
    icon: Building2,
    stagingField: "accounts_raw",
  },
  {
    key: "Contacts",
    label: "Contacts",
    description: "Linked to their company by Zoho Account reference.",
    icon: User,
    stagingField: "contacts_raw",
  },
  {
    key: "Deals",
    label: "Deals (Projects)",
    description: "Linked to their company and primary contact.",
    icon: Briefcase,
    stagingField: "deals_raw",
  },
];

export const DataImportSection = () => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<
    | { tone: "success"; message: string }
    | { tone: "error"; message: string }
    | null
  >(null);

  const logActivity = useCallback(
    (text: string, tone: ActivityEntry["tone"] = "info") => {
      setActivity((prev) => [{ at: Date.now(), text, tone }, ...prev].slice(0, 12));
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await callZoho<ZohoStatus>("/");
      setStatus(next);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void refreshStatus();
  }, [isAdmin, refreshStatus]);

  // Pick up ?zoho_connected=1 / ?zoho_error=… returned by /oauth-callback.
  useEffect(() => {
    const connected = searchParams.get("zoho_connected");
    const error = searchParams.get("zoho_error");
    if (!connected && !error) return;

    if (connected === "1") {
      setOauthBanner({
        tone: "success",
        message: "Connected to Zoho. Refresh token stored — you can sync now.",
      });
      logActivity("Connected to Zoho via OAuth", "success");
      void refreshStatus();
    } else if (error) {
      setOauthBanner({
        tone: "error",
        message: `Zoho connection failed: ${error}`,
      });
      logActivity(`Zoho connection failed: ${error}`, "error");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("zoho_connected");
    next.delete("zoho_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, logActivity, refreshStatus]);

  if (!isAdmin) {
    return (
      <div className="space-y-4 max-w-3xl">
        <h2 className="text-lg font-semibold">Data Import</h2>
        <p className="text-sm text-muted-foreground">
          Only administrators can configure data imports.
        </p>
      </div>
    );
  }

  const connected = status?.credentials.configured === true;

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
            <div className="flex items-start gap-3">
              <div className="rounded-md border bg-muted/40 p-2">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Zoho CRM</CardTitle>
                <CardDescription>
                  {connected
                    ? "Connected · click a module to sync, then promote into the CRM."
                    : "Connect once with a Zoho Grant Token, then sync any combination of Accounts, Contacts and Deals."}
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={busy !== null}
              aria-label="Refresh status"
            >
              {statusLoading ? (
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

          {statusLoading && !status ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Zoho status…
            </p>
          ) : null}

          {oauthBanner ? (
            <div
              className={
                oauthBanner.tone === "success"
                  ? "rounded-md border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-3 text-sm flex items-start gap-2 text-emerald-800 dark:text-emerald-200"
                  : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2 text-destructive"
              }
            >
              {oauthBanner.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5" />
              )}
              <span className="flex-1">{oauthBanner.message}</span>
              <button
                type="button"
                onClick={() => setOauthBanner(null)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {!statusLoading && status && !connected ? (
            <NotConnectedPanel
              busy={busy}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              onSignIn={async (region) => {
                setBusy("oauth");
                try {
                  const redirectAfter = `${window.location.origin}/settings?tab=data`;
                  const result = await callZoho<{
                    ok: boolean;
                    authorize_url: string;
                  }>("/start-oauth", {
                    method: "POST",
                    body: { region, redirect_after: redirectAfter },
                  });
                  window.location.href = result.authorize_url;
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  notify(message, { type: "error", multiLine: true });
                  logActivity(`OAuth start failed: ${message}`, "error");
                  setBusy(null);
                }
              }}
              onConnectGrantToken={async (grantToken, region) => {
                setBusy("connect");
                try {
                  await callZoho("/setup-credentials", {
                    method: "POST",
                    body: { grant_token: grantToken, region },
                  });
                  notify("Connected to Zoho", { type: "success" });
                  logActivity("Connected to Zoho (Grant Token)", "success");
                  await refreshStatus();
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  notify(message, { type: "error", multiLine: true });
                  logActivity(message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            />
          ) : null}

          {!statusLoading && status && connected ? (
            <ConnectedPanel
              status={status}
              busy={busy}
              setBusy={setBusy}
              refreshStatus={refreshStatus}
              logActivity={logActivity}
              notify={notify}
            />
          ) : null}
        </CardContent>
      </Card>

      {activity.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-1.5">
              {activity.map((a) => (
                <li key={a.at} className="flex items-start gap-2">
                  <span
                    className={
                      a.tone === "success"
                        ? "text-emerald-600"
                        : a.tone === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    <CircleDot className="h-3.5 w-3.5 mt-0.5" />
                  </span>
                  <span className="text-muted-foreground tabular-nums w-20 shrink-0">
                    {new Date(a.at).toLocaleTimeString()}
                  </span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-5 w-5" /> Import from CSV
          </CardTitle>
          <CardDescription>
            Unified CSV importer is on the way. For now, keep using the
            per-module CSV import inside Contacts and Companies.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-5 w-5" /> Find duplicates
          </CardTitle>
          <CardDescription>
            After importing, find contacts that share email, phone, or name and
            merge them in a single click.
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

// ----------------------------------- Not connected -----------------------------------

const REGION_OPTIONS = [
  { value: "com", label: ".com (USA)" },
  { value: "eu", label: ".eu" },
  { value: "in", label: ".in" },
  { value: "au", label: ".com.au" },
  { value: "jp", label: ".jp" },
  { value: "ca", label: ".ca" },
];

const NotConnectedPanel = ({
  busy,
  showAdvanced,
  setShowAdvanced,
  onSignIn,
  onConnectGrantToken,
}: {
  busy: string | null;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  onSignIn: (region: string) => void;
  onConnectGrantToken: (grantToken: string, region: string) => void;
}) => {
  const [region, setRegion] = useState("com");
  const [grantToken, setGrantToken] = useState("");

  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-3">
        <p className="font-medium">⚪ Not connected to Zoho</p>
        <p className="text-muted-foreground">
          One click takes you to Zoho, you approve the connection, and Zoho
          sends you back. The refresh token is stored permanently so you
          never have to do it again.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px] items-end">
          <Button
            type="button"
            size="lg"
            onClick={() => onSignIn(region)}
            disabled={busy !== null}
            className="sm:self-end"
          >
            {busy === "oauth" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to
                Zoho…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" /> Sign in with Zoho
              </>
            )}
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="zoho-region-primary">Region</Label>
            <select
              id="zoho-region-primary"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={busy !== null}
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Advanced: connect via Grant Token (manual fallback)
      </button>

      {showAdvanced ? (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-xs text-muted-foreground">
            Only needed if the OAuth redirect can't reach this CRM (e.g. local
            development with a non-https origin).
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
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
            <li>Open the Self Client (not the Server-based one)</li>
            <li>
              Scope:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                ZohoCRM.modules.ALL,ZohoCRM.org.READ,ZohoCRM.users.READ
              </code>
            </li>
            <li>Time duration: 10 minutes</li>
            <li>Paste the generated code below within 10 minutes</li>
          </ol>

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
                {REGION_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !grantToken.trim()}
            onClick={() => onConnectGrantToken(grantToken.trim(), region)}
          >
            {busy === "connect" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting…
              </>
            ) : (
              "Connect via Grant Token"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

// ----------------------------------- Connected -----------------------------------

const ConnectedPanel = ({
  status,
  busy,
  setBusy,
  refreshStatus,
  logActivity,
  notify,
}: {
  status: ZohoStatus;
  busy: string | null;
  setBusy: (v: string | null) => void;
  refreshStatus: () => Promise<void>;
  logActivity: (text: string, tone?: ActivityEntry["tone"]) => void;
  notify: ReturnType<typeof useNotify>;
}) => {
  if (status.credentials.configured !== true) return null;
  const creds = status.credentials;

  const stagingTotal = useMemo(
    () =>
      status.staging.accounts_raw.total +
      status.staging.contacts_raw.total +
      status.staging.deals_raw.total,
    [status],
  );
  const promotableTotal = useMemo(
    () =>
      status.staging.accounts_raw.total -
      status.staging.accounts_raw.promoted +
      (status.staging.contacts_raw.total -
        status.staging.contacts_raw.promoted) +
      (status.staging.deals_raw.total - status.staging.deals_raw.promoted),
    [status],
  );

  const runSync = async (modules: ModuleKey[]) => {
    setBusy(`sync:${modules.join(",")}`);
    try {
      const result = await callZoho<SyncResult>("/sync-all", {
        method: "POST",
        body: { modules },
      });
      const totalFetched = Object.values(result.summary ?? {}).reduce(
        (sum, m) => sum + (m?.totalFetched ?? 0),
        0,
      );
      const totalUpserted = Object.values(result.summary ?? {}).reduce(
        (sum, m) => sum + (m?.totalUpserted ?? 0),
        0,
      );
      const tone =
        Object.values(result.summary ?? {}).some(
          (m) => (m?.errors?.length ?? 0) > 0,
        )
          ? "error"
          : "success";
      logActivity(
        `Synced ${modules.join(", ")}: fetched ${totalFetched}, upserted ${totalUpserted}`,
        tone,
      );
      notify("Sync complete", { type: "success" });
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
      logActivity(`Sync failed: ${message}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const runPromote = async (modules: ModuleKey[], dryRun: boolean) => {
    if (!dryRun) {
      const txt = modules.length === 3 ? "all 3 modules" : modules.join(", ");
      if (
        !window.confirm(
          `Promote staged ${txt} into the CRM? Companies, contacts and deals matching by Zoho id will be updated; new ones inserted.`,
        )
      ) {
        return;
      }
    }
    setBusy(`promote:${modules.join(",")}:${dryRun ? "dry" : "live"}`);
    try {
      const result = await callZoho<PromoteResult>("/promote", {
        method: "POST",
        body: { modules, dry_run: dryRun },
      });
      const totals = Object.entries(result.summary ?? {}).map(
        ([k, v]) => `${k}: ${v.inserted}+, ${v.updated}~, ${v.skipped}-`,
      );
      const allErrors = Object.entries(result.summary ?? {}).flatMap(
        ([k, v]) => (v.errors ?? []).map((err) => `${k}: ${err}`),
      );
      const hasErrors = allErrors.length > 0;
      logActivity(
        `${dryRun ? "Dry-run " : ""}Promoted ${modules.join(", ")} — ${totals.join(" · ")}${
          hasErrors ? ` · ${allErrors.length} errors` : ""
        }`,
        hasErrors ? "error" : "success",
      );
      if (hasErrors) {
        for (const err of allErrors.slice(0, 3)) {
          logActivity(err, "error");
        }
        if (allErrors.length > 3) {
          logActivity(
            `(+${allErrors.length - 3} more errors — see edge function logs for full list)`,
            "error",
          );
        }
        notify(
          `Promotion finished with ${allErrors.length} error(s) — check the activity log`,
          { type: "error", multiLine: true },
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
      logActivity(`Promote failed: ${message}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const runDisconnect = async () => {
    if (
      !window.confirm(
        "Disconnect Zoho? The refresh token will be deleted. You'll need a new Grant Token to reconnect. Staging data is preserved.",
      )
    ) {
      return;
    }
    setBusy("disconnect");
    try {
      await callZoho("/disconnect", { method: "POST" });
      notify("Disconnected from Zoho", { type: "success" });
      logActivity("Disconnected from Zoho", "info");
      await refreshStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      notify(message, { type: "error", multiLine: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Connected to Zoho
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
              <dt>Region</dt>
              <dd className="font-mono">{creds.region}</dd>
              <dt>API domain</dt>
              <dd className="truncate font-mono">{creds.api_domain ?? "—"}</dd>
              <dt>Connected</dt>
              <dd>
                {creds.created_at
                  ? new Date(creds.created_at).toLocaleString()
                  : "—"}
              </dd>
              <dt>Last refresh</dt>
              <dd>
                {creds.last_refreshed_at
                  ? new Date(creds.last_refreshed_at).toLocaleString()
                  : "—"}
              </dd>
            </dl>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={runDisconnect}
            disabled={busy !== null}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-1" /> Disconnect
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => runSync(["Accounts", "Contacts", "Deals"])}
          disabled={busy !== null}
        >
          {busy?.startsWith("sync:Accounts,Contacts,Deals") ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Sync everything
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => runPromote(["Accounts", "Contacts", "Deals"], false)}
          disabled={busy !== null || promotableTotal === 0}
          title={
            promotableTotal === 0
              ? "Nothing to promote — sync first"
              : `${promotableTotal} pending rows`
          }
        >
          {busy?.startsWith("promote:Accounts,Contacts,Deals:live") ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Promote everything ({promotableTotal})
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => runPromote(["Accounts", "Contacts", "Deals"], true)}
          disabled={busy !== null || stagingTotal === 0}
        >
          Dry-run promote
        </Button>
      </div>

      <ul className="space-y-3">
        {MODULE_CONFIG.map((mod) => {
          const staging = status.staging[mod.stagingField];
          const pending = staging.total - staging.promoted;
          const isSyncing = busy === `sync:${mod.key}`;
          const isPromoting = busy === `promote:${mod.key}:live`;
          const Icon = mod.icon;
          return (
            <li
              key={mod.key}
              className="rounded-md border p-3 flex items-start gap-3"
            >
              <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {mod.description}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  In staging:{" "}
                  <span className="font-medium text-foreground">
                    {staging.total}
                  </span>{" "}
                  · Promoted to CRM:{" "}
                  <span className="font-medium text-foreground">
                    {staging.promoted}
                  </span>
                  {pending > 0 ? (
                    <>
                      {" "}
                      · Pending:{" "}
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {pending}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => runSync([mod.key])}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Sync from Zoho
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null || pending === 0}
                    onClick={() => runPromote([mod.key], false)}
                  >
                    {isPromoting ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Promote to CRM
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        Tip: Companies sync first, then Contacts (linked to their company),
        then Deals (linked to company + contact). Promotion respects the same
        order automatically — picking only Deals when no Companies are in
        staging will leave them un-linked.
      </p>
    </div>
  );
};
