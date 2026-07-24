import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MailThread } from "./types";

async function loadThreadIdsByDirection(
  accountId: number | "all",
  direction: "inbound" | "outbound",
): Promise<Set<number>> {
  let q = supabase
    .from("mail_messages")
    .select("thread_id")
    .eq("direction", direction)
    .limit(500);
  if (accountId !== "all") q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row) => Number((row as { thread_id: number }).thread_id))
      .filter(Boolean),
  );
}

/** Threads with outbound mail but no inbound reply — belong in Sent, not Inbox. */
export async function loadSentOnlyThreadIds(
  accountId: number | "all",
): Promise<Set<number>> {
  const [outbound, inbound] = await Promise.all([
    loadThreadIdsByDirection(accountId, "outbound"),
    loadThreadIdsByDirection(accountId, "inbound"),
  ]);
  const sentOnly = new Set<number>();
  for (const id of outbound) {
    if (!inbound.has(id)) sentOnly.add(id);
  }
  return sentOnly;
}
