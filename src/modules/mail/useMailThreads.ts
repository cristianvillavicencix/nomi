import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MailFolderId } from "./MailFolderRail";
import type { MailMessage, MailThread } from "./types";

export function useMailThreads(params: {
  accountId: number | "all";
  folder: MailFolderId;
  search: string;
  labelId?: number | null;
  enabled?: boolean;
}) {
  const {
    accountId,
    folder,
    search,
    labelId = null,
    enabled = true,
  } = params;
  return useQuery({
    queryKey: ["mail_threads", accountId, folder, search, labelId],
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
        rows = applyFolderFilter(rows, folder);
        if (labelId != null) {
          rows = rows.filter((t) =>
            Array.isArray((t as { label_ids?: number[] }).label_ids)
              ? (t as { label_ids: number[] }).label_ids.includes(labelId)
              : false,
          );
        }
        return rows;
      }

      let q = supabase
        .from("mail_threads")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (accountId !== "all") q = q.eq("account_id", accountId);
      if (labelId != null) q = q.contains("label_ids", [labelId]);

      switch (folder) {
        case "inbox":
          q = q.eq("is_trashed", false).eq("is_archived", false);
          break;
        case "unread":
          q = q.eq("is_trashed", false).eq("is_unread", true);
          break;
        case "starred":
          q = q.eq("is_trashed", false).eq("is_starred", true);
          break;
        case "archived":
          q = q.eq("is_trashed", false).eq("is_archived", true);
          break;
        case "trash":
          q = q.eq("is_trashed", true);
          break;
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MailThread[];
    },
  });
}

function applyFolderFilter(
  rows: MailThread[],
  folder: MailFolderId,
): MailThread[] {
  switch (folder) {
    case "inbox":
      return rows.filter((t) => !t.is_trashed && !t.is_archived);
    case "unread":
      return rows.filter((t) => !t.is_trashed && t.is_unread);
    case "starred":
      return rows.filter((t) => !t.is_trashed && t.is_starred);
    case "archived":
      return rows.filter((t) => !t.is_trashed && t.is_archived);
    case "trash":
      return rows.filter((t) => t.is_trashed);
    default:
      return rows;
  }
}

export function useMailMessages(threadId: number | null) {
  return useQuery({
    queryKey: ["mail_messages", threadId],
    enabled: threadId != null,
    refetchInterval: threadId != null ? 30_000 : false,
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
