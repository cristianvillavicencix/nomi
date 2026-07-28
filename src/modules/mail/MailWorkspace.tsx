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
import { useNotify, useGetIdentity } from "ra-core";
import { MailEmptyState } from "./MailEmptyState";
import { MailThreadList } from "./MailThreadList";
import { MailThreadListPagination } from "./MailThreadListPagination";
import {
  MailMessagePane,
  type MailMessagePaneActions,
} from "./MailMessagePane";
import type { MailComposeMode } from "./MailComposeDialog";
import { useMailCompose } from "./MailComposeProvider";
import { MailFolderRail, type MailFolderId } from "./MailFolderRail";
import { MailThreadFilters } from "./MailThreadFilters";
import type { MailListFilter } from "./mailListFilters";
import {
  syncMailAccount,
  applyMailThreadAction,
  type MailThreadAction,
} from "./mailApi";
import {
  readMailAccountFilter,
  readMailFolder,
  writeMailAccountFilter,
  writeMailFolder,
} from "./mailPreferences";
import { mailRfcMessageId } from "./mailHeaders";
import { buildForwardQuoteBlock, buildReplyQuoteBlock } from "./mailQuoteHtml";
import {
  useMailThreads,
  useMailMessages,
  isMailDraftListId,
  mailDraftRecordIdFromListId,
} from "./useMailThreads";
import { useMailInboxUnreadCount } from "./useMailUnreadCount";
import { useMailLabels } from "./useMailLabels";
import { incrementalMailSyncRange } from "./mailSyncRange";
import {
  MAIL_THREADS_DEFAULT_PER_PAGE,
  type MailThreadsPageResult,
} from "./mailListPagination";
import { applyOptimisticMailThreadAction } from "./mailQueryCache";
import {
  isMailTrashShortcutKey,
  shouldIgnoreMailKeyboardShortcut,
} from "./mailKeyboardShortcuts";
import type { MailAccount, MailMessage, MailThread } from "./types";

const MOBILE_FOLDERS: Array<{ id: MailFolderId; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "draft", label: "Drafts" },
  { id: "archive", label: "Archive" },
  { id: "spam", label: "Spam" },
  { id: "trash", label: "Trash" },
];

export function MailWorkspace({ accounts }: { accounts: MailAccount[] }) {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const queryClient = useQueryClient();
  const [accountFilter, setAccountFilter] = useState<number | "all">(() =>
    readMailAccountFilter(),
  );
  const [folder, setFolder] = useState<MailFolderId>(() => readMailFolder());
  const [listFilter, setListFilter] = useState<MailListFilter>("all");
  const [labelId, setLabelId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(MAIL_THREADS_DEFAULT_PER_PAGE);
  const [selected, setSelected] = useState<MailThread | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { openCompose: openGlobalCompose, composeOpen } = useMailCompose();
  const [syncing, setSyncing] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const { data: threadsPage, isPending } = useMailThreads({
    accountId: accountFilter,
    folder,
    listFilter,
    search,
    labelId,
    page,
    perPage,
  });
  const threads = threadsPage?.threads ?? [];
  const listPagination: MailThreadsPageResult = threadsPage ?? {
    threads: [],
    total: 0,
    page,
    perPage,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const { data: labels = [] } = useMailLabels(accountFilter);
  const { data: inboxUnreadCount = 0 } = useMailInboxUnreadCount(accountFilter);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [accountFilter, folder, listFilter, labelId, search, perPage]);

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
    if (action === "archive" && folder !== "archive") {
      return true;
    }
    if (action === "unarchive" && folder === "archive") return true;
    if (action === "spam" && (folder === "inbox" || folder === "starred"))
      return true;
    if (action === "not_spam" && folder === "spam") return true;
    if (action === "unstar" && folder === "starred") return true;
    if (
      action === "mark_read" &&
      listFilter === "unread" &&
      (folder === "trash" || folder === "spam")
    ) {
      return true;
    }
    return false;
  };

  const removeThreadFromListCache = (threadId: number) => {
    queryClient.setQueriesData<MailThreadsPageResult>(
      { queryKey: ["mail_threads"] },
      (old) => {
        if (!old) return old;
        const nextThreads = old.threads.filter((t) => t.id !== threadId);
        if (nextThreads.length === old.threads.length) return old;
        return {
          ...old,
          threads: nextThreads,
          total: Math.max(0, old.total - 1),
        };
      },
    );
  };

  const applyOptimisticListRemoval = (
    thread: MailThread,
    action: MailThreadAction,
  ) => {
    const patch = applyOptimisticMailThreadAction(queryClient, action, thread, {
      identityId: identity?.id,
      accountFilter,
    });
    if (patch !== null && leavesFolderForAction(action, thread)) {
      removeThreadFromListCache(thread.id);
    }
    return patch;
  };

  const shouldRefreshMailQueriesAfterAction = (action: MailThreadAction) =>
    action === "mark_read" || action === "mark_unread";

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

    const optimisticPatch = applyOptimisticListRemoval(thread, action);
    if (selected?.id === thread.id && leavesFolderForAction(action, thread)) {
      selectNeighborAfterRemoval(thread.id);
    } else if (optimisticPatch && Object.keys(optimisticPatch).length > 0) {
      setSelected((prev) => {
        if (prev?.id === thread.id) return { ...prev, ...optimisticPatch };
        if (action === "mark_read") return { ...thread, ...optimisticPatch };
        return prev;
      });
    }

    try {
      await applyMailThreadAction(thread.id, action);
      if (shouldRefreshMailQueriesAfterAction(action)) {
        void queryClient.invalidateQueries({
          queryKey: ["mail_unread_count"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["mail_inbox_unread_count"],
        });
      }
    } catch (e) {
      invalidate();
      notify(e instanceof Error ? e.message : "Action failed", {
        type: "error",
      });
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
    const targets = threads.filter((t) => ids.includes(t.id));
    for (const thread of targets) {
      applyOptimisticListRemoval(thread, action);
    }
    if (
      selected &&
      ids.includes(selected.id) &&
      leavesFolderForAction(action, selected)
    ) {
      selectNeighborAfterRemoval(ids);
    }

    try {
      await applyMailThreadAction(ids, action);
      setSelectedIds(new Set());
    } catch (e) {
      invalidate();
      notify(e instanceof Error ? e.message : "Action failed", {
        type: "error",
      });
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
    openGlobalCompose({
      mode: "new",
      initialDraftId: draftId,
      initialAccountId: row.account_id,
      initialThreadId: row.thread_id ?? undefined,
      initialTo: row.to_emails.join(", "),
      initialCc: row.cc_emails.join(", "),
      initialSubject: row.subject ?? "",
      initialBody: row.body_html ?? "<p><br></p>",
      initialQuotedHtml: null,
      replyTo: thread,
    });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["mail_threads"] });
    void queryClient.invalidateQueries({ queryKey: ["mail_unread_count"] });
    void queryClient.invalidateQueries({
      queryKey: ["mail_inbox_unread_count"],
    });
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
    if (mode === "new") {
      openGlobalCompose({
        mode: "new",
        initialAccountId: accountFilter !== "all" ? accountFilter : undefined,
      });
      return;
    }
    if (!thread || isMailDraftListId(thread.id)) {
      return;
    }
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

    if (contextThread) {
      setSelected(contextThread);
      setMobileShowThread(true);
    }

    if (mode === "reply") {
      openGlobalCompose({
        mode,
        replyTo: thread,
        initialTo: fromEmail,
        initialCc: "",
        initialSubject: "",
        initialBody: "<p><br></p>",
        initialQuotedHtml: buildReplyQuoteBlock(last, thread.snippet),
        initialInReplyTo: mailRfcMessageId(last),
      });
    } else if (mode === "reply_all") {
      openGlobalCompose({
        mode,
        replyTo: thread,
        initialTo: fromEmail,
        initialCc: [...new Set(others)].join(", "),
        initialSubject: "",
        initialBody: "<p><br></p>",
        initialQuotedHtml: buildReplyQuoteBlock(last, thread.snippet),
        initialInReplyTo: mailRfcMessageId(last),
      });
    } else if (mode === "forward") {
      openGlobalCompose({
        mode,
        replyTo: thread,
        initialTo: "",
        initialCc: "",
        initialSubject: "",
        initialBody: "<p><br></p>",
        initialQuotedHtml: buildForwardQuoteBlock(last, thread.snippet),
      });
    }
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
    let totalNew = 0;
    try {
      for (const account of accountsToSync) {
        const range = incrementalMailSyncRange(account.last_sync_at);
        const result = await syncMailAccount(account.id, {
          since: range.since,
          max_results: range.max_results,
        });
        totalNew += result.new_messages ?? 0;
      }
      if (totalNew > 0) {
        notify(`${totalNew} new message${totalNew === 1 ? "" : "s"}`, {
          type: "success",
        });
      } else {
        notify("Inbox is up to date", { type: "info" });
      }
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["mail_accounts_safe"] });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sync failed", { type: "error" });
    } finally {
      setSyncing(false);
    }
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

  useEffect(() => {
    if (accounts.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        shouldIgnoreMailKeyboardShortcut(event, { composeOpen }) ||
        !isMailTrashShortcutKey(event.key)
      ) {
        return;
      }

      event.preventDefault();

      const bulkIds = [...selectedIds].filter((id) => !isMailDraftListId(id));
      if (bulkIds.length > 0) {
        void runBulkAction(folder === "trash" ? "delete_forever" : "trash");
        return;
      }

      if (!selected || isMailDraftListId(selected.id)) return;
      handleListTrash(selected);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accounts.length, composeOpen, folder, selected, selectedIds]);

  if (accounts.length === 0) {
    return <MailEmptyState />;
  }

  const handleListStar = (thread: MailThread) => {
    void runThreadAction(thread, thread.is_starred ? "unstar" : "star");
  };

  const handleListArchive = (thread: MailThread) => {
    if (folder === "spam" || folder === "trash") return;
    void runThreadAction(
      thread,
      folder === "archive" || thread.is_archived ? "unarchive" : "archive",
    );
  };

  const handleListRestore = (thread: MailThread) => {
    void runThreadAction(thread, "untrash");
  };

  const handleListSpam = (thread: MailThread) => {
    if (folder === "spam") {
      void runThreadAction(thread, "not_spam");
      return;
    }
    void runThreadAction(thread, "spam");
  };

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
    if (folder === "archive") {
      return {
        ...base,
        onUnarchive: () => handleListArchive(t),
        onMoveToTrash: () => handleListTrash(t),
      };
    }
    if (folder === "inbox" || folder === "starred") {
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
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl bg-background">
      <MailFolderRail
        className="hidden md:flex"
        folder={folder}
        onFolderChange={(f) => {
          setFolder(f);
          writeMailFolder(f);
          setListFilter("all");
          setPage(1);
          setSelected(null);
          setMobileShowThread(false);
        }}
        accounts={accounts}
        accountFilter={accountFilter}
        onAccountFilterChange={(id) => {
          setAccountFilter(id);
          writeMailAccountFilter(id);
          setPage(1);
          setSelected(null);
          setLabelId(null);
        }}
        labels={labels}
        labelId={labelId}
        onLabelChange={(id) => {
          setLabelId(id);
          setListFilter("all");
          setPage(1);
        }}
        onCompose={() => openCompose("new")}
        inboxUnreadCount={inboxUnreadCount}
      />

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-none md:w-[320px] md:max-w-[360px] md:shrink-0 md:border-r md:border-border/60",
          "bg-muted/15 md:bg-muted/20",
          mobileShowThread && "hidden md:flex",
        )}
      >
        <div className="shrink-0 border-b border-border/40 bg-muted/15 md:bg-muted/20">
          <div className="flex items-center gap-2 px-2 py-2 md:hidden">
            <Select
              value={folder}
              onValueChange={(v) => {
                const next = v as MailFolderId;
                setFolder(next);
                writeMailFolder(next);
                setListFilter("all");
                setLabelId(null);
                setPage(1);
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
                const next = v === "all" ? ("all" as const) : Number(v);
                setAccountFilter(next);
                writeMailAccountFilter(next);
                setPage(1);
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
              setPage(1);
              setSelected(null);
              setMobileShowThread(false);
            }}
            searchQuery={search}
            onSearchQueryChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            syncToolbar={{
              syncing,
              onSync: () => {
                void runQuickSync();
              },
            }}
          />

          {threads.length > 0 ? (
            <div className="flex items-center gap-2 border-t border-border/30 px-3 py-1.5 text-xs text-muted-foreground">
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
                  : listPagination.total > 0
                    ? `${listPagination.total} conversation${listPagination.total === 1 ? "" : "s"}`
                    : "No conversations"}
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
        </div>

        {isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <MailThreadList
                threads={threads}
                selectedId={selected?.id ?? null}
                selectedIds={selectedIds}
                accounts={accounts}
                showMailboxAvatar={accountFilter === "all"}
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
                  const next = thread.is_unread
                    ? { ...thread, is_unread: false }
                    : thread;
                  setSelected(next);
                  setMobileShowThread(true);
                  if (thread.is_unread) {
                    void runThreadAction(thread, "mark_read");
                  }
                }}
              />
            </div>
            <MailThreadListPagination
              result={listPagination}
              onPageChange={setPage}
              onPerPageChange={(next) => {
                setPerPage(next);
                setPage(1);
              }}
            />
          </>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
          !mobileShowThread && "hidden md:flex",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
    </div>
  );
}
