import { supabaseAdmin } from "./supabaseAdmin.ts";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP = 30;

export async function assertFileDownloadRateLimit(
  ip: string | null,
): Promise<{ ok: true } | { ok: false }> {
  if (!ip) return { ok: true };

  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error } = await supabaseAdmin
    .from("file_download_request_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  if (error) {
    console.warn("file_download.rate_limit_count_failed", error.message);
    return { ok: true };
  }

  if ((count ?? 0) >= MAX_REQUESTS_PER_IP) {
    return { ok: false };
  }

  const { error: insertError } = await supabaseAdmin
    .from("file_download_request_log")
    .insert({ ip_address: ip });

  if (insertError) {
    console.warn("file_download.rate_limit_log_failed", insertError.message);
  }

  return { ok: true };
}
