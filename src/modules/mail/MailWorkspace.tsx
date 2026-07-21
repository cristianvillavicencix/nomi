import { useEffect, useMemo, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { MailMessagePane, type MailMessagePaneActions } from "./MailMessagePane";
import {
  MailComposeDialog,
  type MailComposeMode,
} from "./MailComposeDialog";
import { MailSyncRangeDialog } from "./MailSyncRangeDialog";
import {
  MailFolderRail,
  type MailFolderId,
} from "./MailFolderRail";
import { MailDetailToolbar } from "./MailToolbar";
import { MailThreadFilters } from "./MailThreadFilters";
import type { MailListFilter } from "./mailListFilters";
import { syncMailAccount, applyMailThreadAction, type MailThreadAction } from "./mailApi";
import {
  readMailAccountFilter,
  readMailFolder,
  writeMailAccountFilter,
  writeMailFolder,
} from "./mailPreferences";
import type { MailFolderId } from "./MailFolderRail";
import { mailRfcMessageId } from "./mailHeaders";
import {
  useMailThreads,
  useMailMessages,
  isMailDraftListId,
  mailDraftRecordIdFromListId,
} from "./useMailThreads";
import { useMailLabels } from "./useMailLabels";
import type { MailSyncRange } from "./mailSyncRange";
import { incrementalMailSyncRange } from "./mailSyncRange";
import type { MailAccount, MailMessage, MailThread } from "./types";

const MOBILE_FOLDERS: Array<{ id: MailFolderId; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "draft", label: "Drafts" },
  { id: "spam", label: "Spam" },
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
  const [accountFilter, setAccountFilter] = useState<number | "all">(() =>
    readMailAccountFilter(),
  );
  const [folder, setFolder] = useState<MailFolderId>(() => readMailFolder());
  const [listFilter, setListFilter] = useState<MailListFilter>("all");
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
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>();
  const [composeDraftId, setComposeDraftId] = useState<number | null>(null);
  const [composeAccountId, setComposeAccountId] = useState<number | undefined>();
  const [composeThreadId, setComposeThreadId] = useState<number | undefined>();
  const [syncTarget, setSyncTarget] = useState<MailAccount | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { data: threads = [], isPending } = useMailThreads({
    accountId: accountFilter,
    folder,
    listFilter,
    search,
    labelId,
  });
  const { data: labels = [] } = useMailLabels(accountFilter);

  useEffect(() => {
    writeMailFolder(folder);
  }, [folder]);

  useEffect(() => {
    writeMailAccountFilter(accountFilter);
  }, [accountFilter]);

  useEffect(() => {
    if (accountFilter === "all") return;
    if (!accounts.some((a) => a.id === accountFilter)) {
      setAccountFilter("all");
    }
  }, [accounts, accountFilter]);

  const { data: selectedMessages = [] } = useMailMessages(
    selected && !isMailDraftListId(selected.id) ? selected.id : null,
  );

  const leavesFolderForAction = (
    action: MailThreadAction,
    _thread: MailThread,
  ) => {
    if (action === "delete_forever") return true;
    if (action === "trash" && folder !== "trash") return true;
    if (action === "untrash" && folder === "trash") return true;
    if (action === "archive" && folder === "inbox" && listFilter !== "archived") {
      return true;
    }
    if (action === "unarchive" && listFilter === "archived") return true;
    if (action === "spam" && folder === "inbox") return true;
    if (action === "not_spam" && folder === "spam") return true;
    if (action === "unstar" && listFilter === "starred") return true;
    if (
      action === "mark_read" &&
      listFilter === "unread"
    ) {
      return true;
    }
    return false;
  };

  const runThreadAction = async (
    thread: MailThread,
    action: MailThreadAction,
    options?: { skipConfirm?: boolean },
  ) => {
    if (isMailDraftListId(thread.id)) return;
    if (
      action === "delete_forever" &&
      !options?.skipConfirm &&
      !window.confirm(
        "Delete this conversation forever? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await applyMailThreadAction(thread.id, action);
      if (selected?.id === thread.id && leavesFolderForAction(action, thread)) {
        selectNeighborAfterRemoval(thread.id);
      } else if (selected?.id === thread.id && action !== "delete_forever") {
        const patch: Partial<MailThread> = {};
        if (action === "star") patch.is_starred = true;
        if (action === "unstar") patch.is_starred = false;
        if (action === "mark_read") patch.is_unread = false;
        if (action === "mark_unread") patch.is_unread = true;
        if (action === "archive") patch.is_archived = true;
        if (action === "unarchive") patch.is_archived = false;
        if (action === "trash") patch.is_trashed = true;
        if (action === "untrash") patch.is_trashed = false;
        if (action === "spam") patch.is_spam = true;
        if (action === "not_spam") patch.is_spam = false;
        setSelected({ ...thread, ...patch });
      }
      invalidate();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Action failed", { type: "error" });
    }
  };

  const runBulkAction = async (action: MailThreadAction) => {
    const ids = [...selectedIds].filter((id) => !isMailDraftListId(id));
    if (ids.length === 0 && selected && !isMailDraftListId(selected.id)) {
      ids.push(selected.id);
    }
    if (ids.length === 0) return;
    if (
      action === "delete_forever" &&
      !window.confirm(
        `Delete ${ids.length} conversation${ids.length === 1 ? "" : "s"} forever? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await applyMailThreadAction(ids, action);
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) {
        if (leavesFolderForAction(action, selected)) {
          selectNeighborAfterRemoval(ids);
        }
      }
      invalidate();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Action failed", { type: "error" });
    }
  };

  const openDraftFromList = async (thread: MailThread) => {
    const draftId = mailDraftRecordIdFromListId(thread.id);
    const { data, error } = await supabase
      .from("mail_drafts")
      .select(
        "id, account_id, thread_id, to_emails, cc_emails, bcc_emails, subject, body_html",
      )
      .eq("id", draftId)
      .maybeSingle();
    if (error || !data) {
      notify(error?.message ?? "Draft not found", { type: "error" });
      return;
    }
    const row = data as {
      account_id: number;
      thread_id: number | null;
      to_emails: string[];
      cc_emails: string[];
      bcc_emails: string[];
      subject: string | null;
      body_html: string | null;
    };
    setSelected(thread);
    setMobileShowThread(true);
    setComposeMode("new");
    setComposeDraftId(draftId);
    setComposeAccountId(row.account_id);
    setComposeThreadId(row.thread_id ?? undefined);
    setComposeTo(row.to_emails.join(", "));
    setComposeCc(row.cc_emails.join(", "));
    setComposeSubject(row.subject ?? "");
    setComposeBody(row.body_html ?? "<p><br></p>");
    setComposeInReplyTo(undefined);
    setComposeOpen(true);
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mail_threads"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_unread_count"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_messages"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_attachments"] });
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
      void runThreadAction(neighbor, "mark_read");
    }
  };

  const openCompose = (mode: MailComposeMode, contextThread?: MailThread) => {
    const thread = contextThread ?? selected;
    setComposeMode(mode);
    setComposeInReplyTo(undefined);
    setComposeDraftId(null);
    setComposeAccountId(undefined);
    setComposeThreadId(undefined);
    if (mode === "new") {
      setComposeTo("");
      setComposeCc("");
      setComposeSubject("");
      setComposeBody("");
    } else if (thread && !isMailDraftListId(thread.id)) {
      const last =
        thread.id === selected?.id
          ? selectedMessages[selectedMessages.length - 1]
          : undefined;
      const participants = thread.participants ?? [];
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
        setComposeBody(buildReplyQuoteHtml(last, thread.snippet));
        setComposeInReplyTo(mailRfcMessageId(last));
      } else if (mode === "reply_all") {
        setComposeTo(fromEmail);
        setComposeCc([...new Set(others)].join(", "));
        setComposeSubject("");
        setComposeBody(buildReplyQuoteHtml(last, thread.snippet));
        setComposeInReplyTo(mailRfcMessageId(last));
      } else if (mode === "forward") {
        setComposeTo("");
        setComposeCc("");
        setComposeSubject("");
        const quoted = messageBodyHtml(last, thread.snippet);
        setComposeBody(
          `<p><br></p><p>---------- Forwarded message ----------</p>${quoted}`,
        );
      }
      if (contextThread) {
        setSelected(contextThread);
        setMobileShowThread(true);
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
    }
  };

  if (accounts.length === 0) {
    return <MailEmptyState />;
  }

  const listOrganizeEnabled = folder !== "draft";

  const handleListStar = (thread: MailThread) => {
    void runThreadAction(
      thread,
      thread.is_starred ? "unstar" : "star",
    );
  };

  const handleListArchive = (thread: MailThread) => {
    if (folder === "spam" || folder === "trash") return;
    void runThreadAction(
      thread,
      listFilter === "archived" || thread.is_archived ? "unarchive" : "archive",
    );
  };

  const handleListRestore = (thread: MailThread) => {
    void runThreadAction(thread, "untrash");
  };

  const handleListTrash = (thread: MailThread) => {
    if (folder === "trash") {
      void runThreadAction(thread, "delete_forever");
      return;
    }
    if (folder === "spam") {
      void runThreadAction(thread, "not_spam");
      return;
    }
    void runThreadAction(thread, "trash");
  };

  const handleListSpam = (thread: MailThread) => {
    if (folder === "spam") {
      void runThreadAction(thread, "not_spam");
      return;
    }
    void runThreadAction(thread, "spam");
  };

  const listTrashMode =
    folder === "trash"
      ? "delete_forever"
      : folder === "spam"
        ? "not_spam"
        : "trash";

  const showReportSpam = listOrganizeEnabled && folder === "inbox";

  const buildMessagePaneActions = (
    t: MailThread,
  ): MailMessagePaneActions | undefined => {
    if (isMailDraftListId(t.id)) return undefined;
    const base: MailMessagePaneActions = {
      isStarred: t.is_starred,
      onToggleStar: () => handleListStar(t),
    };
    if (folder === "trash") {
      return {
        ...base,
        onRestore: () => handleListRestore(t),
        onDeleteForever: () => handleListTrash(t),
      };
    }
    if (folder === "spam") {
      return {
        ...base,
        onNotSpam: () => handleListSpam(t),
      };
    }
    if (folder === "inbox" && listFilter === "archived") {
      return {
        ...base,
        onUnarchive: () => handleListArchive(t),
        onMoveToTrash: () => handleListTrash(t),
      };
    }
    if (folder === "inbox") {
      return {
        ...base,
        onArchive: () => handleListArchive(t),
        onMoveToTrash: () => handleListTrash(t),
        onReportSpam: () => handleListSpam(t),
      };
    }
    return base;
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      <MailFolderRail
        className="hidden md:flex"
        folder={folder}
        onFolderChange={(f) => {
          setFolder(f);
          writeMailFolder(f);
          setListFilter("all");
          setSelected(null);
          setMobileShowThread(false);
        }}
        accounts={accounts}
        accountFilter={accountFilter}
        onAccountFilterChange={(id) => {
          setAccountFilter(id);
          writeMailAccountFilter(id);
          setSelected(null);
          setLabelId(null);
        }}
        labels={labels}
        labelId={labelId}
        onLabelChange={(id) => {
          setLabelId(id);
          setListFilter("all");
        }}
        onCompose={() => openCompose("new")}
      />

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col md:flex-none md:w-[320px] md:max-w-[360px] md:shrink-0",
          "border-r bg-background",
          mobileShowThread && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b px-2 py-2 md:hidden">
          <Select
            value={folder}
            onValueChange={(v) => {
              const next = v as MailFolderId;
              setFolder(next);
              writeMailFolder(next);
              setListFilter("all");
              setLabelId(null);
              setSelected(null);
              setMobileShowThread(false);
            }}
          >
            <SelectTrigger className="h-8 w-[120px]">
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
          <Select
            value={accountFilter === "all" ? "all" : String(accountFilter)}
            onValueChange={(v) => {
              const next =
                v === "all" ? ("all" as const) : Number(v);
              setAccountFilter(next);
              writeMailAccountFilter(next);
              setSelected(null);
              setLabelId(null);
              setMobileShowThread(false);
            }}
          >
            <SelectTrigger className="h-8 min-w-0 flex-1">
              <SelectValue placeholder="Mailbox" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mailboxes</SelectItem>
              {accounts
                .filter((a) => a.status === "connected")
                .map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.display_name?.trim() || account.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <MailThreadFilters
          folder={folder}
          listFilter={listFilter}
          onListFilterChange={(next) => {
            setListFilter(next);
            setSelected(null);
            setMobileShowThread(false);
          }}
          searchQuery={search}
          onSearchQueryChange={setSearch}
        />

        {threads.length > 0 ? (
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={
                selectedIds.size > 0 && selectedIds.size === threads.length
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
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
            </span>
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap justify-end gap-1">
                {folder !== "trash" && folder !== "spam" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void runBulkAction("star")}
                    >
                      Star
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void runBulkAction("archive")}
                    >
                      Archive
                    </Button>
                    {folder === "inbox" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => void runBulkAction("spam")}
                      >
                        Spam
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void runBulkAction("trash")}
                    >
                      Trash
                    </Button>
                  </>
                ) : null}
                {folder === "trash" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void runBulkAction("untrash")}
                    >
                      Restore
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void runBulkAction("delete_forever")}
                    >
                      Delete forever
                    </Button>
                  </>
                ) : null}
                {folder === "spam" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => void runBulkAction("not_spam")}
                  >
                    Not spam
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <MailThreadList
            threads={threads}
            selectedId={selected?.id ?? null}
            selectedIds={selectedIds}
            showOrganizeActions={listOrganizeEnabled}
            onToggleSelect={(id, on) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (on) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onSelect={(thread) => {
              if (isMailDraftListId(thread.id)) {
                void openDraftFromList(thread);
                return;
              }
              setSelected(thread);
              setMobileShowThread(true);
              if (thread.is_unread) {
                void runThreadAction(thread, "mark_read");
              }
            }}
            onStar={listOrganizeEnabled ? handleListStar : undefined}
            onArchive={
              listOrganizeEnabled && folder !== "spam" && folder !== "trash"
                ? handleListArchive
                : undefined
            }
            onRestore={
              listOrganizeEnabled && folder === "trash"
                ? handleListRestore
                : undefined
            }
            onTrash={listOrganizeEnabled ? handleListTrash : undefined}
            onSpam={showReportSpam ? handleListSpam : undefined}
            trashMode={listTrashMode}
            onReply={
              listOrganizeEnabled
                ? (t) => openCompose("reply", t)
                : undefined
            }
            onForward={
              listOrganizeEnabled
                ? (t) => openCompose("forward", t)
                : undefined
            }
          />
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !mobileShowThread && "hidden md:flex",
        )}
      >
        <MailDetailToolbar
          syncing={syncing}
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

        <div className="min-h-0 flex-1">
          <MailMessagePane
            thread={
              selected && !isMailDraftListId(selected.id) ? selected : null
            }
            threadActions={
              selected ? buildMessagePaneActions(selected) : undefined
            }
            onBack={() => setMobileShowThread(false)}
            onReply={() => openCompose("reply")}
            onReplyAll={() => openCompose("reply_all")}
            onForward={() => openCompose("forward")}
          />
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
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) {
            setComposeDraftId(null);
            setComposeAccountId(undefined);
            setComposeThreadId(undefined);
          }
        }}
        accounts={accounts}
        replyTo={composeMode === "new" ? null : selected}
        mode={composeMode}
        initialTo={composeTo}
        initialCc={composeCc}
        initialSubject={composeSubject}
        initialBody={composeBody}
        initialInReplyTo={composeInReplyTo}
        initialDraftId={composeDraftId}
        initialAccountId={composeAccountId}
        initialThreadId={composeThreadId}
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
