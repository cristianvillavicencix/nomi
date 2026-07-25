import type { QueryClient } from "@tanstack/react-query";
import type { MailThreadAction } from "./mailApi";
import type { MailThreadsPageResult } from "./mailListPagination";
import type { MailThread } from "./types";

export function threadCountsTowardUnreadTotals(thread: MailThread): boolean {
  return (
    thread.is_unread &&
    !thread.is_trashed &&
    !thread.is_archived &&
    !thread.is_draft &&
    !thread.is_spam
  );
}

export function patchMailThreadsInCache(
  queryClient: QueryClient,
  threadId: number,
  patch: Partial<MailThread>,
) {
  queryClient.setQueriesData<MailThreadsPageResult>(
    { queryKey: ["mail_threads"] },
    (old) => {
      if (!old) return old;
      let changed = false;
      const nextThreads = old.threads.map((t) => {
        if (t.id !== threadId) return t;
        changed = true;
        return { ...t, ...patch };
      });
      return changed ? { ...old, threads: nextThreads } : old;
    },
  );
}

export function adjustMailUnreadCountsInCache(
  queryClient: QueryClient,
  params: {
    identityId?: string | number;
    accountFilter: number | "all";
    thread: MailThread;
    delta: -1 | 1;
  },
) {
  const { identityId, accountFilter, thread, delta } = params;
  if (!threadCountsTowardUnreadTotals(thread)) return;

  queryClient.setQueryData<number>(
    ["mail_unread_count", identityId],
    (old) => Math.max(0, (old ?? 0) + delta),
  );

  if (accountFilter === "all" || accountFilter === thread.account_id) {
    queryClient.setQueryData<number>(
      ["mail_inbox_unread_count", identityId, accountFilter],
      (old) => Math.max(0, (old ?? 0) + delta),
    );
  }
}

/** Instant UI feedback before mail_actions completes. Returns thread patch applied. */
export function applyOptimisticMailThreadAction(
  queryClient: QueryClient,
  action: MailThreadAction,
  thread: MailThread,
  params: {
    identityId?: string | number;
    accountFilter: number | "all";
  },
): Partial<MailThread> | null {
  switch (action) {
    case "mark_read": {
      if (!thread.is_unread) return null;
      patchMailThreadsInCache(queryClient, thread.id, { is_unread: false });
      adjustMailUnreadCountsInCache(queryClient, {
        ...params,
        thread,
        delta: -1,
      });
      return { is_unread: false };
    }
    case "mark_unread": {
      if (thread.is_unread) return null;
      const unreadThread = { ...thread, is_unread: true };
      patchMailThreadsInCache(queryClient, thread.id, { is_unread: true });
      adjustMailUnreadCountsInCache(queryClient, {
        ...params,
        thread: unreadThread,
        delta: 1,
      });
      return { is_unread: true };
    }
    case "star":
      patchMailThreadsInCache(queryClient, thread.id, { is_starred: true });
      return { is_starred: true };
    case "unstar":
      patchMailThreadsInCache(queryClient, thread.id, { is_starred: false });
      return { is_starred: false };
    case "archive":
      patchMailThreadsInCache(queryClient, thread.id, {
        is_archived: true,
        is_unread: false,
      });
      if (threadCountsTowardUnreadTotals(thread)) {
        adjustMailUnreadCountsInCache(queryClient, {
          ...params,
          thread,
          delta: -1,
        });
      }
      return { is_archived: true, is_unread: false };
    case "trash":
      patchMailThreadsInCache(queryClient, thread.id, {
        is_trashed: true,
        is_unread: false,
      });
      if (threadCountsTowardUnreadTotals(thread)) {
        adjustMailUnreadCountsInCache(queryClient, {
          ...params,
          thread,
          delta: -1,
        });
      }
      return { is_trashed: true, is_unread: false };
    case "spam":
      patchMailThreadsInCache(queryClient, thread.id, {
        is_spam: true,
        is_unread: false,
      });
      if (threadCountsTowardUnreadTotals(thread)) {
        adjustMailUnreadCountsInCache(queryClient, {
          ...params,
          thread,
          delta: -1,
        });
      }
      return { is_spam: true, is_unread: false };
    default:
      return null;
  }
}
