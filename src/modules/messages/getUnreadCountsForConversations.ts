import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export const UNREAD_COUNTS_QUERY_KEY = "conversations-unread-counts";

export const getUnreadCountsForConversations = async (
  conversationIds: Identifier[],
): Promise<Record<string, number>> => {
  if (conversationIds.length === 0) return {};

  const numericIds = conversationIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (numericIds.length === 0) return {};

  const { data, error } = await supabase.rpc(
    "get_unread_counts_for_conversations",
    { p_conversation_ids: numericIds },
  );

  if (error) {
    throw error;
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const conversationId = row.conversation_id;
    if (conversationId == null) continue;
    counts[String(conversationId)] = Number(row.unread_count ?? 0);
  }

  return counts;
};
