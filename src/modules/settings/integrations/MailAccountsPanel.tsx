import { useEffect, useState } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EnvelopeSimple, ArrowsClockwise, Plugs } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useMailAccounts } from "@/modules/mail/useMailAccounts";
import {
  disconnectMailAccount,
  startMailOAuth,
  syncMailAccount,
} from "@/modules/mail/mailApi";
import { MailImapDialog } from "@/modules/mail/MailImapDialog";
import { MailSyncRangeDialog } from "@/modules/mail/MailSyncRangeDialog";
import type { MailSyncRange } from "@/modules/mail/mailSyncRange";
import type { MailAccount } from "@/modules/mail/types";
import { MailAccountAvatar } from "@/modules/mail/mailAccountAvatar";
import {
  MAIL_BRAND_LABELS,
  resolveMailBrand,
} from "@/modules/mail/mailProviderBrand";

function SyncHealthPanel({ orgAccounts }: { orgAccounts: MailAccount[] }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ["mail_sync_jobs_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mail_sync_jobs")
        .select(
          "id, account_id, status, job_type, error_message, created_at, finished_at",
        )
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (orgAccounts.length === 0 && jobs.length === 0) return null;

  const errorAccounts = orgAccounts.filter(
    (a) => a.status === "error" || a.status === "needs_reconnect",
  );

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">Sync health</h3>
      <p className="text-xs text-muted-foreground">
        Organization mailbox status and recent sync jobs (no personal message
        bodies).
      </p>
      {errorAccounts.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {errorAccounts.map((a) => (
            <li key={a.id} className="text-destructive">
              {a.email}: {a.error_message || a.status}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No organization mailbox errors.
        </p>
      )}
      {jobs.length > 0 ? (
        <ul className="divide-y rounded border text-xs">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap justify-between gap-2 px-2 py-1.5"
            >
              <span>
                Account #{job.account_id} · {job.job_type} ·{" "}
                <span className="capitalize">{job.status}</span>
              </span>
              <span className="text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
              </span>
              {job.error_message ? (
                <span className="w-full text-destructive">{job.error_message}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AccountRows({
  accounts,
  canManage,
  scope,
  onRefresh,
  onRequestSync,
}: {
  accounts: MailAccount[];
  canManage: boolean;
  scope: "org" | "personal";
  onRefresh: () => void;
  onRequestSync: (account: MailAccount) => void;
}) {
  const notify = useNotify();
  const [imapOpen, setImapOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const connect = async (provider: "google" | "microsoft") => {
    try {
      await startMailOAuth({ provider, scope });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not start connection", {
        type: "error",
      });
    }
  };

  const disconnect = async (id: number) => {
    setBusyId(id);
    try {
      await disconnectMailAccount(id);
      notify("Mailbox disconnected", { type: "success" });
      onRefresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Disconnect failed", {
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => connect("google")}>
            <EnvelopeSimple className="size-4" />
            Connect Google
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => connect("microsoft")}
          >
            Connect Microsoft
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setImapOpen(true)}
          >
            Add other account
          </Button>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          No mailboxes yet. Connect Google or Microsoft to get started.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <MailAccountAvatar account={account} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{account.email}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    {MAIL_BRAND_LABELS[resolveMailBrand(account)]}
                  </Badge>
                  <span className="capitalize">
                    {account.status.replace("_", " ")}
                  </span>
                  {account.last_sync_at
                    ? `· Synced ${new Date(account.last_sync_at).toLocaleString()}`
                    : null}
                  {account.error_message ? (
                    <span className="text-destructive">{account.error_message}</span>
                  ) : null}
                </div>
              </div>
              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === account.id}
                    >
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRequestSync(account)}>
                      <ArrowsClockwise className="size-4" />
                      Sync now…
                    </DropdownMenuItem>
                    {(account.status === "needs_reconnect" ||
                      account.status === "error") &&
                      account.provider !== "imap" && (
                        <DropdownMenuItem
                          onClick={() =>
                            void connect(
                              account.provider as "google" | "microsoft",
                            )
                          }
                        >
                          <Plugs className="size-4" />
                          Reconnect
                        </DropdownMenuItem>
                      )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => void disconnect(account.id)}
                    >
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <MailImapDialog
        open={imapOpen}
        onOpenChange={setImapOpen}
        scope={scope}
        onConnected={(accountId, email) => {
          onRefresh();
          onRequestSync({
            id: accountId,
            email,
            provider: "imap",
          } as MailAccount);
        }}
      />
    </div>
  );
}

export function MailAccountsPanel() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: accounts = [], refetch, isPending } = useMailAccounts();
  const [syncTarget, setSyncTarget] = useState<MailAccount | null>(null);

  const canOrgManage = hasMemberCapability(identity as any, "mail.org.manage");
  const canOrgView = hasMemberCapability(identity as any, "mail.org.view");
  const canPersonalManage = hasMemberCapability(
    identity as any,
    "mail.personal.manage",
  );
  const canPersonalView = hasMemberCapability(
    identity as any,
    "mail.personal.view",
  );
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  useEffect(() => {
    if (searchParams.get("mail_connected") === "1") {
      const accountId = Number(searchParams.get("mail_account_id"));
      notify("Mailbox connected — choose how far back to sync", {
        type: "success",
      });
      void refetch().then((result) => {
        const list = result.data ?? [];
        const found =
          list.find((a) => a.id === accountId) ??
          list.find((a) => !a.last_sync_at) ??
          null;
        if (found) setSyncTarget(found);
      });
      const next = new URLSearchParams(searchParams);
      next.delete("mail_connected");
      next.delete("mail_account_id");
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get("mail_error")) {
      notify(searchParams.get("mail_error") || "Connection failed", {
        type: "error",
      });
      const next = new URLSearchParams(searchParams);
      next.delete("mail_error");
      setSearchParams(next, { replace: true });
    }
  }, [notify, refetch, searchParams, setSearchParams]);

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ["mail_accounts_safe"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_threads"] });
  };

  const runSync = async (range: MailSyncRange) => {
    if (!syncTarget) return;
    try {
      const result = await syncMailAccount(syncTarget.id, {
        since: range.since,
        max_results: range.max_results,
      });
      notify(
        `Synced ${result.synced ?? 0} message${
          (result.synced ?? 0) === 1 ? "" : "s"
        }`,
        { type: "success" },
      );
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", { type: "error" });
      throw e;
    }
  };

  const orgAccounts = accounts.filter((a) => a.owner_member_id == null);
  const personalAccounts = accounts.filter(
    (a) => a.owner_member_id != null && a.owner_member_id === identity?.id,
  );

  if (!canOrgView && !canPersonalView) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view mailboxes.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold">Mailboxes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Gmail, Outlook, or another account. When you sync, you choose
          how far back to pull messages into Mail.
        </p>
      </div>

      {canOrgView ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Organization</h3>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <AccountRows
              accounts={orgAccounts}
              canManage={canOrgManage}
              scope="org"
              onRefresh={refresh}
              onRequestSync={setSyncTarget}
            />
          )}
        </section>
      ) : null}

      {canPersonalView ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">My mailboxes</h3>
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <AccountRows
              accounts={personalAccounts}
              canManage={canPersonalManage}
              scope="personal"
              onRefresh={refresh}
              onRequestSync={setSyncTarget}
            />
          )}
        </section>
      ) : null}

      {isAdmin || canOrgManage ? (
        <SyncHealthPanel orgAccounts={orgAccounts} />
      ) : null}

      <MailSyncRangeDialog
        open={syncTarget != null}
        onOpenChange={(open) => {
          if (!open) setSyncTarget(null);
        }}
        accountEmail={syncTarget?.email}
        onConfirm={runSync}
      />
    </div>
  );
}
