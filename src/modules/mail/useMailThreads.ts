import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MailFolderId } from "./MailFolderRail";
import type { MailListFilter } from "./mailListFilters";
import type { MailAttachment, MailDraft, MailMessage, MailThread } from "./types";
import { excludeSentOnlyThreads } from "./mailListFilters";
import { loadSentOnlyThreadIds } from "./mailThreadFolders";
import {
  buildMailThreadsPageResult,
  MAIL_THREADS_DEFAULT_PER_PAGE,
  mailThreadsPageRange,
  type MailThreadsPageResult,
} from "./mailListPagination";

/** Synthetic list ids for mail_drafts rows (avoid collision with mail_threads.id). */
export const MAIL_DRAFT_LIST_ID_OFFSET = 1_000_000_000;

export function isMailDraftListId(id: number): boolean {
  return id >= MAIL_DRAFT_LIST_ID_OFFSET;
}

export function mailDraftRecordIdFromListId(id: number): number {
  return id - MAIL_DRAFT_LIST_ID_OFFSET;
}

const EMPTY_PAGE: MailThreadsPageResult = {
  threads: [],
  total: 0,
  page: 1,
  perPage: MAIL_THREADS_DEFAULT_PER_PAGE,
  hasNextPage: false,
  hasPreviousPage: false,
};

function draftToListThread(d: MailDraft, accountEmail?: string): MailThread {
  const snippet = (d.body_html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const who =
    d.to_emails[0] ||
    accountEmail ||
    "Draft";
  return {
    id: MAIL_DRAFT_LIST_ID_OFFSET + d.id,
    account_id: d.account_id,
    org_id: d.org_id,
    provider_thread_id: `draft-${d.id}`,
    subject: d.subject,
    snippet: snippet || null,
    participants: [{ email: who }],
    last_message_at: d.updated_at,
    is_unread: false,
    is_starred: false,
    is_draft: true,
    is_archived: false,
    is_trashed: false,
    is_spam: false,
    message_count: 0,
  };
}

async function loadSentThreadIds(
  accountId: number | "all",
): Promise<number[]> {
  let q = supabase
    .from("mail_messages")
    .select("thread_id")
    .eq("direction", "outbound")
    .limit(500);
  if (accountId !== "all") q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return [
    ...new Set(
      (data ?? [])
        .map((row) => Number((row as { thread_id: number }).thread_id))
        .filter(Boolean),
    ),
  ];
}

function applyInboxListFilter<Q extends { eq: (column: string, value: unknown) => Q }>(
  q: Q,
  listFilter: MailListFilter,
): Q {
  switch (listFilter) {
    case "archived":
      return q.eq("is_trashed", false).eq("is_archived", true);
    case "starred":
      return q.eq("is_trashed", false).eq("is_starred", true);
    case "unread":
      return q
        .eq("is_trashed", false)
        .eq("is_archived", false)
        .eq("is_draft", false)
        .eq("is_unread", true);
    case "all":
    default:
      return q
        .eq("is_trashed", false)
        .eq("is_archived", false)
        .eq("is_draft", false)
        .eq("is_spam", false);
  }
}

async function applyFolderFilter(
  rows: MailThread[],
  folder: MailFolderId,
  listFilter: MailListFilter,
  accountId: number | "all",
): Promise<MailThread[]> {
  switch (folder) {
    case "draft":
      return rows.filter((t) => t.is_draft && !t.is_trashed);
    case "trash":
      return rows.filter((t) => t.is_trashed);
    case "spam":
      return rows.filter((t) => t.is_spam && !t.is_trashed);
    case "starred":
      return rows.filter((t) => !t.is_trashed && t.is_starred);
    case "archive":
      return rows.filter((t) => !t.is_trashed && t.is_archived);
    case "sent": {
      const sentIds = new Set(await loadSentThreadIds(accountId));
      let filtered = rows.filter((t) => !t.is_trashed && sentIds.has(t.id));
      if (listFilter === "unread") {
        filtered = filtered.filter((t) => t.is_unread);
      }
      return filtered;
    }
    case "inbox":
    default:
      {
        const sentOnlyIds =
          folder === "inbox"
            ? await loadSentOnlyThreadIds(accountId)
            : new Set<number>();
        switch (listFilter) {
          case "archived":
            return excludeSentOnlyThreads(
              rows.filter((t) => !t.is_trashed && t.is_archived),
              sentOnlyIds,
            );
          case "starred":
            return excludeSentOnlyThreads(
              rows.filter((t) => !t.is_trashed && t.is_starred),
              sentOnlyIds,
            );
          case "unread":
            return excludeSentOnlyThreads(
              rows.filter(
                (t) =>
                  !t.is_trashed &&
                  !t.is_archived &&
                  !t.is_draft &&
                  !t.is_spam &&
                  t.is_unread,
              ),
              sentOnlyIds,
            );
          case "all":
          default:
            return excludeSentOnlyThreads(
              rows.filter(
                (t) =>
                  !t.is_trashed && !t.is_archived && !t.is_draft && !t.is_spam,
              ),
              sentOnlyIds,
            );
        }
      }
  }
}

async function fetchInboxPage(params: {
  accountId: number | "all";
  listFilter: MailListFilter;
  labelId: number | null;
  page: number;
  perPage: number;
}): Promise<MailThreadsPageResult> {
  const { accountId, listFilter, labelId, page, perPage } = params;
  const sentOnlyIds = await loadSentOnlyThreadIds(accountId);
  const start = (page - 1) * perPage;
  const needCount = start + perPage + 1;
  const filtered: MailThread[] = [];
  let dbOffset = 0;
  const batchSize = Math.max(perPage, 50);

  while (filtered.length < needCount) {
    let q = supabase
      .from("mail_threads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(dbOffset, dbOffset + batchSize - 1);
    if (accountId !== "all") q = q.eq("account_id", accountId);
    if (labelId != null) q = q.contains("label_ids", [labelId]);
    q = applyInboxListFilter(q, listFilter);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as MailThread[];
    if (batch.length === 0) break;
    filtered.push(...excludeSentOnlyThreads(batch, sentOnlyIds));
    if (batch.length < batchSize) break;
    dbOffset += batchSize;
  }

  let countQ = supabase
    .from("mail_threads")
    .select("*", { count: "exact", head: true });
  if (accountId !== "all") countQ = countQ.eq("account_id", accountId);
  if (labelId != null) countQ = countQ.contains("label_ids", [labelId]);
  countQ = applyInboxListFilter(countQ, listFilter);
  const { count, error: countError } = await countQ;
  if (countError) throw countError;

  const pageThreads = filtered.slice(start, start + perPage);
  const total = Math.max(0, (count ?? 0) - sentOnlyIds.size);

  return buildMailThreadsPageResult({
    threads: pageThreads,
    total,
    page,
    perPage,
  });
}

async function fetchThreadPage(params: {
  accountId: number | "all";
  page: number;
  perPage: number;
  applyQuery: (
    q: ReturnType<typeof supabase.from>,
  ) => ReturnType<typeof supabase.from>;
  postFilter?: (rows: MailThread[]) => MailThread[];
}): Promise<MailThreadsPageResult> {
  const { accountId, page, perPage, applyQuery, postFilter } = params;
  const { from, to } = mailThreadsPageRange(page, perPage);

  let q = supabase
    .from("mail_threads")
    .select("*", { count: "exact" })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, to);
  if (accountId !== "all") q = q.eq("account_id", accountId);
  q = applyQuery(q);

  const { data, error, count } = await q;
  if (error) throw error;
  let rows = (data ?? []) as MailThread[];
  if (postFilter) rows = postFilter(rows);

  return buildMailThreadsPageResult({
    threads: rows,
    total: count,
    page,
    perPage,
  });
}

export function useMailThreads(params: {
  accountId: number | "all";
  folder: MailFolderId;
  listFilter?: MailListFilter;
  search: string;
  labelId?: number | null;
  page?: number;
  perPage?: number;
  enabled?: boolean;
}) {
  const {
    accountId,
    folder,
    listFilter = "all",
    search,
    labelId = null,
    page = 1,
    perPage = MAIL_THREADS_DEFAULT_PER_PAGE,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      "mail_threads",
      accountId,
      folder,
      listFilter,
      search,
      labelId,
      page,
      perPage,
    ],
    enabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<MailThreadsPageResult> => {
      const trimmed = search.trim();
      const { from } = mailThreadsPageRange(page, perPage);

      if (trimmed.length > 0) {
        const [{ data, error }, { data: totalRaw, error: countError }] =
          await Promise.all([
            supabase.rpc("mail_search_threads", {
              p_query: trimmed,
              p_account_id: accountId === "all" ? null : accountId,
              p_limit: perPage,
              p_offset: from,
            }),
            supabase.rpc("mail_search_threads_count", {
              p_query: trimmed,
              p_account_id: accountId === "all" ? null : accountId,
            }),
          ]);
        if (error) throw error;
        if (countError) throw countError;
        let rows = (data ?? []) as MailThread[];
        rows = await applyFolderFilter(rows, folder, listFilter, accountId);
        if (labelId != null) {
          rows = rows.filter((t) => {
            const ids = (t as MailThread & { label_ids?: number[] }).label_ids;
            return Array.isArray(ids) ? ids.includes(labelId) : false;
          });
        }
        return buildMailThreadsPageResult({
          threads: rows,
          total: Number(totalRaw ?? rows.length),
          page,
          perPage,
        });
      }

      if (folder === "sent") {
        const sentIds = await loadSentThreadIds(accountId);
        if (sentIds.length === 0) {
          return { ...EMPTY_PAGE, page, perPage };
        }
        return fetchThreadPage({
          accountId,
          page,
          perPage,
          applyQuery: (q) =>
            q
              .in("id", sentIds)
              .eq("is_trashed", false)
              .eq("is_draft", false),
          postFilter:
            listFilter === "unread"
              ? (rows) => rows.filter((t) => t.is_unread)
              : undefined,
        });
      }

      if (folder === "draft") {
        let q = supabase
          .from("mail_drafts")
          .select(
            "id, account_id, org_id, thread_id, to_emails, cc_emails, bcc_emails, subject, body_html, updated_at",
            { count: "exact" },
          )
          .order("updated_at", { ascending: false, nullsFirst: false })
          .range(from, from + perPage - 1);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        const { data, error, count } = await q;
        if (error) throw error;
        return buildMailThreadsPageResult({
          threads: (data ?? []).map((row) =>
            draftToListThread(row as MailDraft),
          ),
          total: count,
          page,
          perPage,
        });
      }

      if (folder === "trash") {
        return fetchThreadPage({
          accountId,
          page,
          perPage,
          applyQuery: (q) => q.eq("is_trashed", true),
          postFilter:
            listFilter === "unread"
              ? (rows) => rows.filter((t) => t.is_unread)
              : undefined,
        });
      }

      if (folder === "spam") {
        return fetchThreadPage({
          accountId,
          page,
          perPage,
          applyQuery: (q) => q.eq("is_spam", true).eq("is_trashed", false),
          postFilter:
            listFilter === "unread"
              ? (rows) => rows.filter((t) => t.is_unread)
              : undefined,
        });
      }

      if (folder === "starred") {
        return fetchThreadPage({
          accountId,
          page,
          perPage,
          applyQuery: (q) => {
            let next = q.eq("is_trashed", false).eq("is_starred", true);
            if (labelId != null) next = next.contains("label_ids", [labelId]);
            return next;
          },
        });
      }

      if (folder === "archive") {
        return fetchThreadPage({
          accountId,
          page,
          perPage,
          applyQuery: (q) => {
            let next = q.eq("is_trashed", false).eq("is_archived", true);
            if (labelId != null) next = next.contains("label_ids", [labelId]);
            return next;
          },
        });
      }

      if (folder === "inbox") {
        return fetchInboxPage({
          accountId,
          listFilter,
          labelId,
          page,
          perPage,
        });
      }

      return fetchThreadPage({
        accountId,
        page,
        perPage,
        applyQuery: (q) => {
          let next = applyInboxListFilter(q, listFilter);
          if (labelId != null) next = next.contains("label_ids", [labelId]);
          return next;
        },
      });
    },
  });
}

export function useMailMessages(threadId: number | null) {
  return useQuery({
    queryKey: ["mail_messages", threadId],
    enabled: threadId != null && !isMailDraftListId(threadId),
    refetchInterval:
      threadId != null && !isMailDraftListId(threadId) ? 30_000 : false,
    queryFn: async (): Promise<MailMessage[]> => {
      const { data, error } = await supabase
        .from("mail_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("sent_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as MailMessage[];
    },
  });
}

export function useMailDraft(draftId: number | null) {
  return useQuery({
    queryKey: ["mail_draft", draftId],
    enabled: draftId != null,
    queryFn: async (): Promise<MailDraft | null> => {
      const { data, error } = await supabase
        .from("mail_drafts")
        .select(
          "id, account_id, org_id, thread_id, to_emails, cc_emails, bcc_emails, subject, body_html, updated_at",
        )
        .eq("id", draftId!)
        .maybeSingle();
      if (error) throw error;
      return (data as MailDraft | null) ?? null;
    },
  });
}

export function useMailAttachments(messageIds: number[]) {
  const key = messageIds.slice().sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["mail_attachments", key],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mail_attachments")
        .select(
          "id, message_id, filename, mime_type, size_bytes, storage_path, content_id",
        )
        .in("message_id", messageIds);
      if (error) throw error;
      return (data ?? []) as MailAttachment[];
    },
  });
}
