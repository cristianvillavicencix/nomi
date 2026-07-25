import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_MAX_PER_MINUTE = 20;

export async function assertAssistantRateLimit(params: {
  supabase: SupabaseClient;
  memberId: number;
  maxPerMinute?: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const max = params.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE;
  const since = new Date(Date.now() - 60_000).toISOString();

  const { count, error } = await params.supabase
    .from("assistant_messages")
    .select("id", { count: "exact", head: true })
    .eq("member_id", params.memberId)
    .eq("role", "user")
    .gte("created_at", since);

  if (error) {
    // Fail open on count errors so assistant stays usable; log-like message in result.
    console.warn("assistant rate limit count failed", error.message);
    return { ok: true };
  }

  if ((count ?? 0) >= max) {
    return {
      ok: false,
      message: `Rate limit exceeded (${max} messages per minute). Try again shortly.`,
    };
  }

  return { ok: true };
}
