import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MailFolderId } from "./MailFolderRail";
import type { MailListFilter } from "./mailListFilters";
import type { MailAttachment, MailDraft, MailMessage, MailThread } from "./types";

/** Synthetic list ids for mail_drafts rows (avoid collision with mail_threads.id). */
export const MAIL_DRAFT_LIST_ID_OFFSET = 1_000_000_000;

export function isMailDraftListId(id: number): boolean {
  return id >= MAIL_DRAFT_LIST_ID_OFFSET;
}

export function mailDraftRecordIdFromListId(id: number): number {
  return id - MAIL_DRAFT_LIST_ID_OFFSET;
}

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

export function useMailThreads(params: {
  accountId: number | "all";
  folder: MailFolderId;
  listFilter?: MailListFilter;
  search: string;
  labelId?: number | null;
  enabled?: boolean;
}) {
  const {
    accountId,
    folder,
    listFilter = "all",
    search,
    labelId = null,
    enabled = true,
  } = params;
  return useQuery({
    queryKey: ["mail_threads", accountId, folder, listFilter, search, labelId],
    enabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<MailThread[]> => {
      const trimmed = search.trim();
      if (trimmed.length > 0) {
        const { data, error } = await supabase.rpc("mail_search_threads", {
          p_query: trimmed,
          p_account_id: accountId === "all" ? null : accountId,
          p_limit: 100,
        });
        if (error) throw error;
        let rows = (data ?? []) as MailThread[];
        rows = await applyFolderFilter(rows, folder, listFilter, accountId);
        if (labelId != null) {
          rows = rows.filter((t) => {
            const ids = (t as MailThread & { label_ids?: number[] }).label_ids;
            return Array.isArray(ids) ? ids.includes(labelId) : false;
          });
        }
        return rows;
      }

      if (folder === "sent") {
        const sentIds = await loadSentThreadIds(accountId);
        if (sentIds.length === 0) return [];
        let q = supabase
          .from("mail_threads")
          .select("*")
          .in("id", sentIds)
          .eq("is_trashed", false)
          .eq("is_draft", false)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        if (labelId != null) q = q.contains("label_ids", [labelId]);
        const { data, error } = await q;
        if (error) throw error;
        let rows = (data ?? []) as MailThread[];
        if (listFilter === "unread") {
          rows = rows.filter((t) => t.is_unread);
        }
        return rows;
      }

      if (folder === "draft") {
        let q = supabase
          .from("mail_drafts")
          .select(
            "id, account_id, org_id, thread_id, to_emails, cc_emails, bcc_emails, subject, body_html, updated_at",
          )
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []).map((row) =>
          draftToListThread(row as MailDraft),
        );
      }

      if (folder === "trash") {
        let q = supabase
          .from("mail_threads")
          .select("*")
          .eq("is_trashed", true)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        const { data, error } = await q;
        if (error) throw error;
        let rows = (data ?? []) as MailThread[];
        if (listFilter === "unread") {
          rows = rows.filter((t) => t.is_unread);
        }
        return rows;
      }

      if (folder === "spam") {
        let q = supabase
          .from("mail_threads")
          .select("*")
          .eq("is_spam", true)
          .eq("is_trashed", false)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        const { data, error } = await q;
        if (error) throw error;
        let rows = (data ?? []) as MailThread[];
        if (listFilter === "unread") {
          rows = rows.filter((t) => t.is_unread);
        }
        return rows;
      }

      if (folder === "starred") {
        let q = supabase
          .from("mail_threads")
          .select("*")
          .eq("is_trashed", false)
          .eq("is_starred", true)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        if (labelId != null) q = q.contains("label_ids", [labelId]);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as MailThread[];
      }

      if (folder === "archive") {
        let q = supabase
          .from("mail_threads")
          .select("*")
          .eq("is_trashed", false)
          .eq("is_archived", true)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100);
        if (accountId !== "all") q = q.eq("account_id", accountId);
        if (labelId != null) q = q.contains("label_ids", [labelId]);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as MailThread[];
      }

      let q = supabase
        .from("mail_threads")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (accountId !== "all") q = q.eq("account_id", accountId);
      if (labelId != null) q = q.contains("label_ids", [labelId]);

      q = applyInboxListFilter(q, listFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MailThread[];
    },
  });
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
      switch (listFilter) {
        case "archived":
          return rows.filter((t) => !t.is_trashed && t.is_archived);
        case "starred":
          return rows.filter((t) => !t.is_trashed && t.is_starred);
        case "unread":
          return rows.filter(
            (t) =>
              !t.is_trashed &&
              !t.is_archived &&
              !t.is_draft &&
              !t.is_spam &&
              t.is_unread,
          );
        case "all":
        default:
          return rows.filter(
            (t) =>
              !t.is_trashed && !t.is_archived && !t.is_draft && !t.is_spam,
          );
      }
  }
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
