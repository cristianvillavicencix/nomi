import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  authenticateMailMember,
  assertAccountAccess,
  getFreshGoogleAccessToken,
  getFreshMicrosoftAccessToken,
  loadMailAccount,
  upsertThreadAndMessage,
  type MailAccountRow,
} from "../_shared/mailAccount.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type SyncOptions = {
  since: string | null;
  maxResults: number;
};

function parseSyncOptions(body: Record<string, unknown>): SyncOptions {
  const sinceRaw = body.since;
  let since: string | null = null;
  if (typeof sinceRaw === "string" && sinceRaw.trim()) {
    const d = new Date(sinceRaw);
    if (!Number.isNaN(d.getTime())) since = d.toISOString();
  }
  const maxResults = Math.min(
    500,
    Math.max(10, Number(body.max_results) || 200),
  );
  return { since, maxResults };
}

function gmailAfterQuery(since: string | null): string {
  if (!since) return "in:inbox";
  const d = new Date(since);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `in:inbox after:${y}/${m}/${day}`;
}

async function syncGoogle(account: MailAccountRow, opts: SyncOptions) {
  const accessToken = await getFreshGoogleAccessToken(account);
  const q = encodeURIComponent(gmailAfterQuery(opts.since));
  let pageToken: string | undefined;
  let synced = 0;
  const seen = new Set<string>();

  while (synced < opts.maxResults) {
    const pageSize = Math.min(100, opts.maxResults - synced);
    let url =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${pageSize}&q=${q}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const listRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listJson = await listRes.json();
    if (!listRes.ok) {
      throw new Error(listJson.error?.message || "Gmail list failed");
    }
    const messages = (listJson.messages ?? []) as Array<{
      id: string;
      threadId: string;
    }>;
    if (messages.length === 0) break;

    for (const msg of messages) {
      if (seen.has(msg.id)) continue;
      seen.add(msg.id);
      if (synced >= opts.maxResults) break;

      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const detail = await detailRes.json();
      if (!detailRes.ok) continue;
      const headers = (detail.payload?.headers ?? []) as Array<{
        name: string;
        value: string;
      }>;
      const getH = (n: string) =>
        headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ??
          null;
      const subject = getH("Subject");
      const fromRaw = getH("From") || "";
      const toRaw = getH("To") || "";
      const ccRaw = getH("Cc") || "";
      const fromMatch = fromRaw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
      const fromName = fromMatch?.[1]?.trim() || null;
      const fromEmail =
        (fromMatch?.[2] || fromRaw).trim().toLowerCase() || null;
      const parseAddrs = (raw: string) =>
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const m = s.match(/<([^>]+)>/);
            return (m?.[1] || s).toLowerCase();
          });

      let bodyHtml: string | null = null;
      let bodyText: string | null = null;
      const walk = (part: Record<string, unknown> | undefined) => {
        if (!part) return;
        const mime = String(part.mimeType || "");
        const data = (part.body as { data?: string } | undefined)?.data;
        if (data && mime === "text/html" && !bodyHtml) {
          bodyHtml = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
        }
        if (data && mime === "text/plain" && !bodyText) {
          bodyText = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
        }
        const parts = part.parts as Record<string, unknown>[] | undefined;
        if (parts) parts.forEach((p) => walk(p));
      };
      walk(detail.payload);

      const labelIds = (detail.labelIds ?? []) as string[];
      const isUnread = labelIds.includes("UNREAD");
      const internalDate = detail.internalDate
        ? new Date(Number(detail.internalDate)).toISOString()
        : null;

      await upsertThreadAndMessage({
        account,
        providerThreadId: String(detail.threadId || msg.threadId),
        providerMessageId: String(detail.id || msg.id),
        subject,
        snippet: detail.snippet ?? null,
        fromEmail,
        fromName,
        toEmails: parseAddrs(toRaw),
        ccEmails: parseAddrs(ccRaw),
        bodyHtml,
        bodyText,
        sentAt: internalDate,
        isUnread,
        direction:
          fromEmail === account.email.toLowerCase() ? "outbound" : "inbound",
        hasAttachments: Boolean(
          detail.payload?.parts?.some?.(
            (p: { filename?: string }) => p.filename,
          ),
        ),
      });
      synced += 1;
    }

    pageToken = listJson.nextPageToken;
    if (!pageToken) break;
  }

  const labelsRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (labelsRes.ok) {
    const labelsJson = await labelsRes.json();
    for (const label of labelsJson.labels ?? []) {
      if (label.type !== "user") continue;
      await supabaseAdmin.from("mail_labels").upsert(
        {
          account_id: account.id,
          org_id: account.org_id,
          provider_label_id: label.id,
          name: label.name,
        },
        { onConflict: "account_id,provider_label_id" },
      );
    }
  }

  return synced;
}

async function syncMicrosoft(account: MailAccountRow, opts: SyncOptions) {
  const accessToken = await getFreshMicrosoftAccessToken(account);
  let synced = 0;
  let nextUrl: string | null =
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${
      Math.min(50, opts.maxResults)
    }&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,body`;

  if (opts.since) {
    const filter = encodeURIComponent(
      `receivedDateTime ge ${new Date(opts.since).toISOString()}`,
    );
    nextUrl += `&$filter=${filter}`;
  }

  while (nextUrl && synced < opts.maxResults) {
    const listRes = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listJson = await listRes.json();
    if (!listRes.ok) {
      throw new Error(listJson.error?.message || "Graph mail list failed");
    }
    const batch = listJson.value ?? [];
    if (batch.length === 0) break;

    for (const msg of batch) {
      if (synced >= opts.maxResults) break;
      const fromEmail = msg.from?.emailAddress?.address?.toLowerCase() ?? null;
      const fromName = msg.from?.emailAddress?.name ?? null;
      const toEmails = (msg.toRecipients ?? [])
        .map((r: { emailAddress?: { address?: string } }) =>
          String(r.emailAddress?.address || "").toLowerCase()
        )
        .filter(Boolean);
      const ccEmails = (msg.ccRecipients ?? [])
        .map((r: { emailAddress?: { address?: string } }) =>
          String(r.emailAddress?.address || "").toLowerCase()
        )
        .filter(Boolean);
      await upsertThreadAndMessage({
        account,
        providerThreadId: String(msg.conversationId || msg.id),
        providerMessageId: String(msg.id),
        subject: msg.subject ?? null,
        snippet: msg.bodyPreview ?? null,
        fromEmail,
        fromName,
        toEmails,
        ccEmails,
        bodyHtml: msg.body?.contentType === "html" ? msg.body.content : null,
        bodyText: msg.body?.contentType === "text" ? msg.body.content : null,
        sentAt: msg.receivedDateTime ?? null,
        isUnread: msg.isRead === false,
        direction:
          fromEmail === account.email.toLowerCase() ? "outbound" : "inbound",
        hasAttachments: Boolean(msg.hasAttachments),
      });
      synced += 1;
    }
    nextUrl = listJson["@odata.nextLink"] ?? null;
  }
  return synced;
}

async function syncImap(
  account: MailAccountRow,
  opts: SyncOptions,
) {
  const workerUrl = Deno.env.get("MAIL_IMAP_WORKER_URL")?.trim();
  const workerSecret = Deno.env.get("MAIL_IMAP_WORKER_SECRET")?.trim();
  if (!workerUrl) {
    throw new Error(
      "IMAP sync requires the mail-imap worker. Set MAIL_IMAP_WORKER_URL (see workers/mail-imap).",
    );
  }
  const res = await fetch(workerUrl.replace(/\/$/, "") + "/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
    },
    body: JSON.stringify({
      account_id: account.id,
      since: opts.since,
      max_results: opts.maxResults,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "IMAP worker sync failed");
  }
  const payload = await res.json().catch(() => ({}));
  return Number(payload.synced ?? 0);
}

async function runSync(accountId: number, opts: SyncOptions) {
  const account = await loadMailAccount(accountId);
  if (!account) throw new Error("Account not found");

  const { data: job } = await supabaseAdmin
    .from("mail_sync_jobs")
    .insert({
      account_id: account.id,
      org_id: account.org_id,
      status: "running",
      job_type: "incremental",
      started_at: new Date().toISOString(),
      meta: { since: opts.since, max_results: opts.maxResults },
    })
    .select("id")
    .single();

  try {
    let synced = 0;
    if (account.provider === "google") {
      synced = await syncGoogle(account, opts);
    } else if (account.provider === "microsoft") {
      synced = await syncMicrosoft(account, opts);
    } else if (account.provider === "imap") {
      synced = await syncImap(account, opts);
    } else {
      throw new Error(`Unsupported provider: ${account.provider}`);
    }

    const prevCursor =
      account.sync_cursor && typeof account.sync_cursor === "object"
        ? account.sync_cursor
        : {};
    await supabaseAdmin
      .from("mail_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        status: "connected",
        error_message: null,
        sync_cursor: {
          ...prevCursor,
          last_since: opts.since,
          last_max_results: opts.maxResults,
          last_synced_count: synced,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (job?.id) {
      await supabaseAdmin
        .from("mail_sync_jobs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          meta: {
            synced,
            since: opts.since,
            max_results: opts.maxResults,
          },
        })
        .eq("id", job.id);
    }
    return { ok: true, synced, since: opts.since };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await supabaseAdmin
      .from("mail_accounts")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    if (job?.id) {
      await supabaseAdmin
        .from("mail_sync_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", job.id);
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticateMailMember(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  const opts = parseSyncOptions(body as Record<string, unknown>);

  if (body.action === "cron" || body.sync_due === true) {
    if (auth.member.user_id !== "service_role") {
      return json({ error: "Forbidden" }, 403);
    }
    const { data: due } = await supabaseAdmin.rpc("mail_accounts_due_for_sync", {
      p_limit: Number(body.limit) || 10,
    });
    const results = [];
    for (const row of due ?? []) {
      try {
        const cursor = row.sync_cursor as { last_since?: string } | null;
        const cronOpts: SyncOptions = {
          since: cursor?.last_since ??
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults: 100,
        };
        results.push(await runSync(row.id, cronOpts));
      } catch (e) {
        results.push({
          account_id: row.id,
          error: e instanceof Error ? e.message : "failed",
        });
      }
    }
    return json({ ok: true, results });
  }

  const accountId = Number(body.account_id);
  if (!accountId) return json({ error: "account_id required" }, 400);

  const account = await loadMailAccount(accountId);
  if (!account) return json({ error: "Not found" }, 404);

  if (auth.member.user_id !== "service_role") {
    const denied = assertAccountAccess(auth.member, account, "view");
    if (denied) return json({ error: denied }, 403);
    if (account.org_id !== auth.member.org_id) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  try {
    const result = await runSync(accountId, opts);
    return json(result);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      500,
    );
  }
});
