import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

const port = Number(process.env.PORT || 8788);
const secret = process.env.MAIL_IMAP_WORKER_SECRET || "";
const supabaseUrl = process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SMTP_CONNECT_MS = 25_000;
const SENT_FOLDER_CANDIDATES = [
  "Sent",
  "Sent Items",
  "Sent Messages",
  "INBOX.Sent",
  "INBOX.Sent Items",
  "[Gmail]/Sent Mail",
];

function authorize(req) {
  if (!secret) return true;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === secret;
}

function admin() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function buildSmtpTransportOptions(host, smtpPort) {
  const secure = smtpPort === 465;
  return {
    host,
    port: smtpPort,
    secure,
    requireTLS: !secure && smtpPort === 587,
    connectionTimeout: SMTP_CONNECT_MS,
    greetingTimeout: SMTP_CONNECT_MS,
    socketTimeout: SMTP_CONNECT_MS,
    auth: undefined, // filled by caller
  };
}

function smtpPortCandidates(preferred) {
  const primary = preferred || 465;
  const alts = primary === 465 ? [587, 465] : [465, 587];
  return [...new Set([primary, ...alts])];
}

async function createWorkingTransporter({ host, preferredPort, user, pass }) {
  if (!host) throw new Error("Missing SMTP host on account");
  const errors = [];
  for (const smtpPort of smtpPortCandidates(preferredPort)) {
    const base = buildSmtpTransportOptions(host, smtpPort);
    const transporter = nodemailer.createTransport({
      ...base,
      auth: { user, pass },
    });
    try {
      await transporter.verify();
      return { transporter, smtpPort };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${host}:${smtpPort} — ${msg}`);
      try {
        transporter.close();
      } catch {
        /* ignore */
      }
    }
  }
  throw new Error(
    `SMTP connection failed (tried ${smtpPortCandidates(preferredPort)
      .map((p) => `${host}:${p}`)
      .join(", ")}). ${errors.join(" | ")}`,
  );
}

async function upsertMessage(sb, account, parsed, rawUid, mailbox = "INBOX") {
  const fromEmail = (parsed.from?.value?.[0]?.address || "").toLowerCase() || null;
  const fromName = parsed.from?.value?.[0]?.name || null;
  const toEmails = (parsed.to?.value || []).map((a) => a.address?.toLowerCase()).filter(Boolean);
  const ccEmails = (parsed.cc?.value || []).map((a) => a.address?.toLowerCase()).filter(Boolean);
  const providerMessageId = String(parsed.messageId || `imap-${account.id}-${mailbox}-${rawUid}`);
  const providerThreadId = String(
    parsed.inReplyTo || parsed.references?.[0] || providerMessageId,
  );
  const sentAt = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();
  const subject = parsed.subject || null;
  const snippet = (parsed.text || "").slice(0, 200) || null;
  const accountEmail = String(account.email || "").toLowerCase();
  const isSentMailbox = /sent/i.test(mailbox);
  const direction =
    isSentMailbox || fromEmail === accountEmail ? "outbound" : "inbound";

  const { data: existingThread } = await sb
    .from("mail_threads")
    .select("id, message_count")
    .eq("account_id", account.id)
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle();

  let threadId = existingThread?.id;
  if (threadId) {
    await sb
      .from("mail_threads")
      .update({
        subject,
        snippet,
        last_message_at: sentAt,
        is_unread: direction === "inbound",
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  } else {
    const { data: inserted, error } = await sb
      .from("mail_threads")
      .insert({
        account_id: account.id,
        org_id: account.org_id,
        provider_thread_id: providerThreadId,
        subject,
        snippet,
        participants: [
          ...(fromEmail ? [{ email: fromEmail, name: fromName }] : []),
          ...toEmails.map((email) => ({ email })),
        ],
        last_message_at: sentAt,
        is_unread: direction === "inbound",
        message_count: 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    threadId = inserted.id;
  }

  const { data: existingMsg } = await sb
    .from("mail_messages")
    .select("id")
    .eq("account_id", account.id)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!existingMsg) {
    const rawHtml = parsed.html || null;
    const bodyHtml = rawHtml
      ? rawHtml
          .replace(/<img\b[^>]*\bsrc\s*=\s*["']cid:[^"']+["'][^>]*>/gi, "")
          .replace(/\bsrc\s*=\s*(["'])cid:[^"']+\1/gi, "src=$1$1")
          .replace(/url\((["']?)cid:[^)"']+\1\)/gi, "none")
      : null;
    await sb.from("mail_messages").insert({
      thread_id: threadId,
      account_id: account.id,
      org_id: account.org_id,
      provider_message_id: providerMessageId,
      direction,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: toEmails,
      cc_emails: ccEmails,
      subject,
      body_html: bodyHtml,
      body_text: parsed.text || null,
      sent_at: sentAt,
      is_read: direction === "outbound",
      has_attachments: (parsed.attachments?.length || 0) > 0,
      send_status: direction === "outbound" ? "sent" : null,
    });
    await sb
      .from("mail_threads")
      .update({ message_count: (existingThread?.message_count ?? 0) + 1 })
      .eq("id", threadId);
  }
}

async function resolveSentMailbox(client) {
  const boxes = await client.list();
  const flat = [];
  const walk = (list) => {
    for (const box of list || []) {
      flat.push(box);
      if (box.folders?.length) walk(box.folders);
    }
  };
  walk(boxes);
  for (const name of SENT_FOLDER_CANDIDATES) {
    const hit = flat.find(
      (b) => b.path === name || b.name === name || b.path?.endsWith(name),
    );
    if (hit?.path) return hit.path;
  }
  const fuzzy = flat.find(
    (b) =>
      /sent/i.test(b.path || "") ||
      /sent/i.test(b.name || "") ||
      (Array.isArray(b.specialUse) && b.specialUse.includes("\\Sent")) ||
      b.specialUse === "\\Sent",
  );
  return fuzzy?.path || null;
}

async function syncMailbox(client, sb, account, mailbox, since, maxResults) {
  let synced = 0;
  let lock;
  try {
    lock = await client.getMailboxLock(mailbox);
  } catch {
    return 0;
  }
  try {
    const searchQuery =
      since && !Number.isNaN(since.getTime()) ? { since } : { all: true };
    const uids = await client.search(searchQuery, { uid: true });
    const list = Array.isArray(uids) ? uids : [];
    const slice = list.slice(-maxResults).reverse();
    for (const uid of slice) {
      const msg = await client.fetchOne(uid, { source: true, uid: true }, { uid: true });
      if (!msg?.source) continue;
      const parsed = await simpleParser(msg.source);
      await upsertMessage(sb, account, parsed, uid, mailbox);
      synced += 1;
    }
  } finally {
    lock.release();
  }
  return synced;
}

async function syncAccount(body) {
  const sb = admin();
  const accountId = Number(body.account_id);
  const maxResults = Math.min(500, Math.max(10, Number(body.max_results) || 200));
  const since = body.since ? new Date(body.since) : null;
  const perBox = Math.max(10, Math.ceil(maxResults / 2));

  const { data: account, error } = await sb
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (error || !account) throw new Error("Account not found");
  if (account.provider !== "imap") throw new Error("Not an IMAP account");

  const password = account.token_payload?.password;
  const user = account.imap_username || account.email;
  if (!password || !account.imap_host) {
    throw new Error("Missing IMAP credentials on account");
  }

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  });

  let synced = 0;
  await client.connect();
  try {
    synced += await syncMailbox(client, sb, account, "INBOX", since, perBox);
    const sentPath = await resolveSentMailbox(client);
    if (sentPath) {
      synced += await syncMailbox(client, sb, account, sentPath, since, perBox);
    }
  } finally {
    await client.logout().catch(() => {});
  }

  await sb
    .from("mail_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      status: "connected",
      error_message: null,
    })
    .eq("id", account.id);

  return { ok: true, synced, account_id: accountId };
}

async function sendAccount(body) {
  const sb = admin();
  const accountId = Number(body.account_id);
  const { data: account, error } = await sb
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (error || !account) throw new Error("Account not found");

  const password = account.token_payload?.password;
  const user = account.imap_username || account.email;
  if (!password || !account.smtp_host) {
    throw new Error(
      "Missing SMTP credentials on account. Reconnect the mailbox and set SMTP host (e.g. smtp.hostinger.com) and port 465 or 587.",
    );
  }

  const { transporter, smtpPort } = await createWorkingTransporter({
    host: account.smtp_host,
    preferredPort: account.smtp_port || 465,
    user,
    pass: password,
  });

  try {
    await transporter.sendMail({
      from: account.email,
      to: (body.to || []).join(", "),
      cc: (body.cc || []).join(", ") || undefined,
      bcc: (body.bcc || []).join(", ") || undefined,
      subject: body.subject || "",
      html: body.body_html || "",
      attachments: Array.isArray(body.attachments)
        ? body.attachments
            .filter((a) => a && a.content_base64 && a.filename)
            .map((a) => ({
              filename: String(a.filename),
              contentType: String(a.content_type || "application/octet-stream"),
              content: Buffer.from(String(a.content_base64), "base64"),
            }))
        : undefined,
    });
  } finally {
    try {
      transporter.close();
    } catch {
      /* ignore */
    }
  }

  // Persist working port if we fell back
  if (account.smtp_port !== smtpPort) {
    await sb
      .from("mail_accounts")
      .update({
        smtp_port: smtpPort,
        smtp_security: smtpPort === 587 ? "starttls" : "ssl",
      })
      .eq("id", account.id);
  }

  return { ok: true, smtp_port: smtpPort };
}

const server = http.createServer(async (req, res) => {
  const send = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true });
    }
    if (!authorize(req)) return send(401, { error: "Unauthorized" });

    const body = await readJson(req);

    if (req.method === "POST" && req.url === "/sync") {
      const result = await syncAccount(body);
      return send(200, result);
    }
    if (req.method === "POST" && req.url === "/send") {
      const result = await sendAccount(body);
      return send(200, result);
    }
    return send(404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    return send(500, { error: e instanceof Error ? e.message : "Worker error" });
  }
});

server.listen(port, () => {
  console.log(`mail-imap worker listening on :${port}`);
});
