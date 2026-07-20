import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PencilSimple, GearSix, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { MailEmptyState } from "./MailEmptyState";
import { MailThreadList } from "./MailThreadList";
import { MailMessagePane } from "./MailMessagePane";
import {
  MailComposeDialog,
  type MailComposeMode,
} from "./MailComposeDialog";
import { MailSyncRangeDialog } from "./MailSyncRangeDialog";
import {
  MailFolderRail,
  type MailFolderId,
} from "./MailFolderRail";
import { MailToolbar } from "./MailToolbar";
import { mailboxesSettingsPath } from "./mailSettingsPath";
import { syncMailAccount } from "./mailApi";
import { useMailThreads, useMailMessages } from "./useMailThreads";
import { useMailLabels } from "./useMailLabels";
import type { MailSyncRange } from "./mailSyncRange";
import { incrementalMailSyncRange } from "./mailSyncRange";
import type { MailAccount, MailMessage, MailThread } from "./types";

const MOBILE_FOLDERS: Array<{ id: MailFolderId; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
  { id: "trash", label: "Trash" },
];

function messageBodyHtml(
  last: MailMessage | undefined,
  snippet: string | null | undefined,
): string {
  if (last?.body_html?.trim()) return last.body_html;
  if (last?.body_text?.trim()) {
    return `<p>${last.body_text.replace(/\n/g, "<br/>")}</p>`;
  }
  if (snippet?.trim()) return `<p>${snippet}</p>`;
  return "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReplyQuoteHtml(last: MailMessage | undefined, snippet: string | null) {
  const quoted = messageBodyHtml(last, snippet);
  const from = escapeHtml(
    last?.from_name?.trim() || last?.from_email?.trim() || "Unknown",
  );
  const when = last?.sent_at
    ? escapeHtml(new Date(last.sent_at).toLocaleString())
    : "";
  const header = when
    ? `On ${when}, ${from} wrote:`
    : `${from} wrote:`;
  return `<p><br></p><p>${header}</p><blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex">${quoted || "<p></p>"}</blockquote>`;
}

export function MailWorkspace({ accounts }: { accounts: MailAccount[] }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [folder, setFolder] = useState<MailFolderId>("inbox");
  const [labelId, setLabelId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MailThread | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<MailComposeMode>("new");
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [syncTarget, setSyncTarget] = useState<MailAccount | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { data: threads = [], isPending } = useMailThreads({
    accountId: accountFilter,
    folder,
    search,
    labelId,
  });
  const { data: labels = [] } = useMailLabels(accountFilter);
  const { data: selectedMessages = [] } = useMailMessages(selected?.id ?? null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mail_threads"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_unread_count"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_messages"] });
  };

  /** After removing the open thread from the current folder, open the next (or previous) in the list. */
  const selectNeighborAfterRemoval = (removedIds: number | number[]) => {
    const removed = new Set(
      Array.isArray(removedIds) ? removedIds : [removedIds],
    );
    const currentId = selected?.id;
    if (currentId == null || !removed.has(currentId)) {
      return;
    }
    const index = threads.findIndex((t) => t.id === currentId);
    if (index < 0) {
      setSelected(null);
      setMobileShowThread(false);
      return;
    }
    let neighbor: MailThread | null = null;
    for (let i = index + 1; i < threads.length; i++) {
      if (!removed.has(threads[i].id)) {
        neighbor = threads[i];
        break;
      }
    }
    if (!neighbor) {
      for (let i = index - 1; i >= 0; i--) {
        if (!removed.has(threads[i].id)) {
          neighbor = threads[i];
          break;
        }
      }
    }
    setSelected(neighbor);
    setMobileShowThread(Boolean(neighbor));
    if (neighbor?.is_unread) {
      void updateThreadQuiet(neighbor, { is_unread: false });
    }
  };

  const updateThreadQuiet = async (
    thread: MailThread,
    patch: Partial<MailThread>,
  ) => {
    const { error } = await supabase
      .from("mail_threads")
      .update(patch)
      .eq("id", thread.id);
    if (error) return;
    if (patch.is_unread === false) {
      await supabase
        .from("mail_messages")
        .update({ is_read: true })
        .eq("thread_id", thread.id);
    }
    invalidate();
  };

  const updateThread = async (
    thread: MailThread,
    patch: Partial<MailThread>,
  ) => {
    const leavesFolder =
      patch.is_trashed === true ||
      patch.is_archived === true ||
      (folder === "unread" && patch.is_unread === false) ||
      (folder === "starred" && patch.is_starred === false);

    const { error } = await supabase
      .from("mail_threads")
      .update(patch)
      .eq("id", thread.id);
    if (error) {
      notify(error.message, { type: "error" });
      return;
    }
    if (patch.is_unread === false) {
      await supabase
        .from("mail_messages")
        .update({ is_read: true })
        .eq("thread_id", thread.id);
    }
    if (selected?.id === thread.id) {
      if (leavesFolder) {
        selectNeighborAfterRemoval(thread.id);
      } else {
        setSelected({ ...thread, ...patch });
      }
    }
    invalidate();
  };

  const bulkUpdate = async (patch: Partial<MailThread>) => {
    const ids = [...selectedIds];
    if (ids.length === 0 && selected) ids.push(selected.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("mail_threads")
      .update(patch)
      .in("id", ids);
    if (error) {
      notify(error.message, { type: "error" });
      return;
    }
    setSelectedIds(new Set());
    if (selected && ids.includes(selected.id)) {
      if (patch.is_trashed || patch.is_archived) {
        selectNeighborAfterRemoval(ids);
      } else {
        setSelected({ ...selected, ...patch });
      }
    }
    invalidate();
  };

  const openCompose = (mode: MailComposeMode) => {
    setComposeMode(mode);
    if (mode === "new") {
      setComposeTo("");
      setComposeCc("");
      setComposeSubject("");
      setComposeBody("");
    } else if (selected) {
      const last = selectedMessages[selectedMessages.length - 1];
      const participants = selected.participants ?? [];
      const fromEmail = last?.from_email || participants[0]?.email || "";
      const others = [
        ...(last?.to_emails ?? []),
        ...(last?.cc_emails ?? []),
        ...participants.map((p) => p.email).filter(Boolean),
      ].filter((e): e is string => Boolean(e) && e !== fromEmail);

      if (mode === "reply") {
        setComposeTo(fromEmail);
        setComposeCc("");
        setComposeSubject("");
        setComposeBody(buildReplyQuoteHtml(last, selected.snippet));
      } else if (mode === "reply_all") {
        setComposeTo(fromEmail);
        setComposeCc([...new Set(others)].join(", "));
        setComposeSubject("");
        setComposeBody(buildReplyQuoteHtml(last, selected.snippet));
      } else if (mode === "forward") {
        setComposeTo("");
        setComposeCc("");
        setComposeSubject("");
        const quoted = messageBodyHtml(last, selected.snippet);
        setComposeBody(
          `<p><br></p><p>---------- Forwarded message ----------</p>${quoted}`,
        );
      }
    }
    setComposeOpen(true);
  };

  const accountsToSync = useMemo(() => {
    const connected = accounts.filter((a) => a.status === "connected");
    if (accountFilter === "all") return connected;
    const one = connected.find((a) => a.id === accountFilter);
    return one ? [one] : connected.slice(0, 1);
  }, [accountFilter, accounts]);

  const runQuickSync = async () => {
    if (accountsToSync.length === 0 || syncing) return;
    setSyncing(true);
    let total = 0;
    try {
      for (const account of accountsToSync) {
        const range = incrementalMailSyncRange(account.last_sync_at);
        const result = await syncMailAccount(account.id, {
          since: range.since,
          max_results: range.max_results,
        });
        total += result.synced ?? 0;
      }
      notify(
        `Synced ${total} message${total === 1 ? "" : "s"}`,
        { type: "success" },
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["mail_accounts_safe"] });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", { type: "error" });
    } finally {
      setSyncing(false);
    }
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
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["mail_accounts_safe"] });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", { type: "error" });
      throw e;
    }
  };

  if (accounts.length === 0) {
    return <MailEmptyState />;
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      <MailFolderRail
        className="hidden md:flex"
        folder={folder}
        onFolderChange={(f) => {
          setFolder(f);
          setSelected(null);
          setMobileShowThread(false);
        }}
        accounts={accounts}
        accountFilter={accountFilter}
        onAccountFilterChange={(id) => {
          setAccountFilter(id);
          setSelected(null);
          setLabelId(null);
        }}
        labels={labels}
        labelId={labelId}
        onLabelChange={setLabelId}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Select
            value={folder}
            onValueChange={(v) => {
              setFolder(v as MailFolderId);
              setLabelId(null);
              setSelected(null);
              setMobileShowThread(false);
            }}
          >
            <SelectTrigger className="h-8 w-[120px] md:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOBILE_FOLDERS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 min-w-[10rem] max-w-sm flex-1"
            placeholder="Search mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link to={mailboxesSettingsPath()}>
                <GearSix className="size-4" />
                Mailboxes
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => openCompose("new")}
            >
              <Plus className="size-4" />
              Compose
            </Button>
          </div>
        </div>

        <MailToolbar
          thread={selected}
          syncing={syncing}
          onReply={() => openCompose("reply")}
          onReplyAll={() => openCompose("reply_all")}
          onForward={() => openCompose("forward")}
          onToggleStar={() => {
            if (!selected) return;
            void updateThread(selected, { is_starred: !selected.is_starred });
          }}
          onArchive={() => {
            if (!selected) return;
            void updateThread(selected, { is_archived: true });
          }}
          onTrash={() => {
            if (!selected) return;
            void updateThread(selected, { is_trashed: true });
          }}
          onToggleRead={() => {
            if (!selected) return;
            void updateThread(selected, { is_unread: !selected.is_unread });
          }}
          onSync={() => {
            void runQuickSync();
          }}
          onSyncFromDate={() => {
            const target =
              accountFilter === "all"
                ? accountsToSync[0] ?? null
                : accountsToSync[0] ?? null;
            if (target) setSyncTarget(target);
          }}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(260px,340px)_1fr]">
          <div
            className={cn(
              "flex min-h-0 flex-col border-r",
              mobileShowThread && "hidden md:flex",
            )}
          >
            {threads.length > 0 ? (
              <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={
                    selectedIds.size > 0 &&
                    selectedIds.size === threads.length
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(threads.map((t) => t.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
                <span className="flex-1">
                  {folder.charAt(0).toUpperCase() + folder.slice(1)}
                  {selectedIds.size > 0
                    ? ` · ${selectedIds.size} selected`
                    : ` · ${threads.length}`}
                </span>
                {selectedIds.size > 0 ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void bulkUpdate({ is_starred: true })}
                    >
                      Star
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void bulkUpdate({ is_archived: true })}
                    >
                      Archive
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void bulkUpdate({ is_trashed: true })}
                    >
                      Trash
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isPending ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <MailThreadList
                threads={threads}
                selectedId={selected?.id ?? null}
                selectedIds={selectedIds}
                onToggleSelect={(id, on) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
                onSelect={(thread) => {
                  setSelected(thread);
                  setMobileShowThread(true);
                  if (thread.is_unread) {
                    void updateThread(thread, { is_unread: false });
                  }
                }}
              />
            )}
          </div>

          <div
            className={cn(
              "min-h-0",
              !mobileShowThread && "hidden md:block",
            )}
          >
            <MailMessagePane
              thread={selected}
              onBack={() => setMobileShowThread(false)}
              onReply={() => openCompose("reply")}
              onReplyAll={() => openCompose("reply_all")}
              onForward={() => openCompose("forward")}
            />
          </div>
        </div>
      </div>

      {/* Floating compose on small screens when rail hidden */}
      <Button
        type="button"
        size="icon"
        className="fixed bottom-20 right-4 z-20 size-12 rounded-full shadow-lg md:hidden"
        aria-label="Compose"
        onClick={() => openCompose("new")}
      >
        <PencilSimple className="size-5" />
      </Button>

      <MailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        accounts={accounts}
        replyTo={composeMode === "new" ? null : selected}
        mode={composeMode}
        initialTo={composeTo}
        initialCc={composeCc}
        initialSubject={composeSubject}
        initialBody={composeBody}
      />

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
