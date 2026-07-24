import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { consumeFileAccessToken } from "../_shared/fileAccessToken.ts";
import { assertFileDownloadRateLimit } from "../_shared/fileDownloadRateLimit.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip")?.trim() ??
    null
  );
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\r\n"\\]/g, "_").replace(/\//g, "_").slice(0, 180) || "file";
}

function contentDisposition(filename: string, inline: boolean): string {
  const safe = sanitizeFilename(filename);
  const encoded = encodeURIComponent(safe);
  const type = inline ? "inline" : "attachment";
  return `${type}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const inline = url.searchParams.get("disposition") === "inline";
  const ip = clientIp(req);

  const rateLimit = await assertFileDownloadRateLimit(ip);
  if (!rateLimit.ok) {
    console.warn("file_download.rate_limited", { ip });
    const headers = new Headers(corsHeaders);
    headers.set("Retry-After", "60");
    headers.set("X-RateLimit-Limit", "30");
    return new Response("Not found", { status: 404, headers });
  }

  try {
    const row = await consumeFileAccessToken(token);
    if (!row) {
      console.warn("file_download.invalid_token", { ip });
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(row.bucket)
      .download(row.storage_path);

    if (error || !data) {
      console.error("file_download.storage_miss", {
        purpose: row.purpose,
        ip,
        error: error?.message,
      });
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    if (data.size > MAX_DOWNLOAD_BYTES) {
      console.warn("file_download.too_large", {
        purpose: row.purpose,
        ip,
        size: data.size,
      });
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const mimeType = row.mime_type || data.type || "application/octet-stream";
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", mimeType);
    headers.set(
      "Content-Disposition",
      contentDisposition(row.filename, inline),
    );
    headers.set("Cache-Control", "private, max-age=60");
    if (row.max_uses != null) {
      const remaining = Math.max(0, row.max_uses - row.uses_count - 1);
      headers.set("X-Download-Uses-Remaining", String(remaining));
    }

    console.info("file_download.ok", { purpose: row.purpose, ip });
    return new Response(data.stream(), { status: 200, headers });
  } catch (e) {
    console.error("file_download.error", e);
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
});
