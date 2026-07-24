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
const MAIL_ATTACHMENTS_BUCKET = "mail-attachments";
const MAX_MAIL_ATTACHMENTS = 5;
const MAX_MAIL_FILE_BYTES = 4 * 1024 * 1024;
const MAX_MAIL_TOTAL_BYTES = 8 * 1024 * 1024;
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
      .join(", ")}). ${errors.join(" | ")}` +
      (errors.some((e) => /timeout|ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(e))
        ? " If this worker runs on Render free tier, outbound SMTP (465/587) is blocked — deploy to Cloud Run (see workers/mail-imap/CLOUD_RUN.md) or upgrade Render to a paid plan."
        : ""),
  );
}

function sanitizeAttachmentFilename(name) {
  return (
    String(name || "attachment")
      .replace(/[\r\n"\\]/g, "_")
      .replace(/\//g, "_")
      .slice(0, 180) || "attachment"
  );
}

function normalizeRfcMessageId(value) {
  return String(value || "").replace(/^<|>$/g, "").trim();
}

async function storageObjectExists(sb, storagePath) {
  if (!storagePath?.trim()) return false;
  const { data, error } = await sb.storage
    .from(MAIL_ATTACHMENTS_BUCKET)
    .download(storagePath);
  return !error && Boolean(data);
}

async function syncImapMessageAttachments(sb, account, messageId, attachments) {
  if (!messageId || !attachments?.length) return;

  let totalBytes = 0;
  let count = 0;
  for (const att of attachments) {
    if (count >= MAX_MAIL_ATTACHMENTS) break;
    const content = att.content;
    if (!content?.length) continue;
    if (content.length > MAX_MAIL_FILE_BYTES) continue;
    if (totalBytes + content.length > MAX_MAIL_TOTAL_BYTES) break;

    const rawContentId = att.contentId || att.cid || null;
    const contentId = rawContentId
      ? String(rawContentId).replace(/^<|>$/g, "").replace(/^cid:/i, "").toLowerCase()
      : null;
    const filename = sanitizeAttachmentFilename(
      att.filename ||
        (contentId ? `inline-${contentId.slice(0, 48)}` : `attachment-${count + 1}`),
    );
    const providerId = String(
      rawContentId || att.checksum || att.contentId || att.cid || `imap-${count}`,
    ).replace(/[<>]/g, "");

    const { data: existing } = await sb
      .from("mail_attachments")
      .select("id, storage_path")
      .eq("message_id", messageId)
      .eq("provider_attachment_id", providerId)
      .maybeSingle();
    if (existing?.id) {
      if (
        existing.storage_path &&
        (await storageObjectExists(sb, existing.storage_path))
      ) {
        continue;
      }
      await sb.from("mail_attachments").delete().eq("id", existing.id);
    }

    const storagePath = `${account.org_id}/${account.id}/${messageId}/${providerId}-${filename}`;

    const { error: uploadError } = await sb.storage
      .from(MAIL_ATTACHMENTS_BUCKET)
      .upload(storagePath, content, {
        contentType: att.contentType || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) {
      console.error("imap_attachment_upload_failed", uploadError.message);
      continue;
    }

    const { error: insertError } = await sb.from("mail_attachments").insert({
      message_id: messageId,
      account_id: account.id,
      org_id: account.org_id,
      provider_attachment_id: providerId,
      filename,
      mime_type: att.contentType || null,
      size_bytes: content.length,
      storage_path: storagePath,
      content_id: contentId,
    });
    if (insertError) {
      console.error("imap_attachment_row_failed", insertError.message);
      continue;
    }
    totalBytes += content.length;
    count += 1;
  }
}

function isInlineImageAttachment(att) {
  if (!att.content?.length) return false;
  const mime = String(att.contentType || "").toLowerCase();
  if (!mime.startsWith("image/")) return false;
  const cid = att.contentId || att.cid;
  const disposition = String(att.contentDisposition || "").toLowerCase();
  return Boolean(cid) || disposition === "inline" || att.related === true;
}

function isFileAttachment(att) {
  if (!att.content?.length || !att.filename) return false;
  return !isInlineImageAttachment(att);
}

async function findExistingMessage(sb, accountId, providerMessageId) {
  const normalized = normalizeRfcMessageId(providerMessageId);
  const candidates = [
    providerMessageId,
    normalized,
    normalized ? `<${normalized}>` : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const { data } = await sb
      .from("mail_messages")
      .select("id, provider_message_id")
      .eq("account_id", accountId)
      .eq("provider_message_id", candidate)
      .maybeSingle();
    if (data?.id) return data;
  }
  return null;
}

async function findDuplicateOutboundMessage(
  sb,
  account,
  { subject, sentAt, fromEmail, providerMessageId },
) {
  const existing = await findExistingMessage(sb, account.id, providerMessageId);
  if (existing?.id) return existing;
  if (!subject || !fromEmail) return null;

  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return null;
  const windowStart = new Date(sent.getTime() - 2 * 60 * 1000).toISOString();
  const windowEnd = new Date(sent.getTime() + 2 * 60 * 1000).toISOString();

  const { data: candidates } = await sb
    .from("mail_messages")
    .select("id, provider_message_id")
    .eq("account_id", account.id)
    .eq("direction", "outbound")
    .eq("from_email", fromEmail)
    .eq("subject", subject)
    .gte("sent_at", windowStart)
    .lte("sent_at", windowEnd)
    .order("id", { ascending: false })
    .limit(5);

  const normalized = normalizeRfcMessageId(providerMessageId);
  for (const row of candidates ?? []) {
    const pid = String(row.provider_message_id || "");
    if (pid.startsWith("local-")) return row;
    if (normalized && normalizeRfcMessageId(pid) === normalized) return row;
  }
  return null;
}

async function upsertMessage(sb, account, parsed, rawUid, mailbox = "INBOX") {
  const fromEmail = (parsed.from?.value?.[0]?.address || "").toLowerCase() || null;
  const fromName = parsed.from?.value?.[0]?.name || null;
  const toEmails = (parsed.to?.value || []).map((a) => a.address?.toLowerCase()).filter(Boolean);
  const ccEmails = (parsed.cc?.value || []).map((a) => a.address?.toLowerCase()).filter(Boolean);
  const providerMessageId = String(parsed.messageId || `imap-${account.id}-${mailbox}-${rawUid}`);
  const normalizedProviderMessageId = normalizeRfcMessageId(providerMessageId);
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

  let existingMsg = await findExistingMessage(sb, account.id, providerMessageId);
  if (!existingMsg && direction === "outbound") {
    existingMsg = await findDuplicateOutboundMessage(sb, account, {
      subject,
      sentAt,
      fromEmail,
      providerMessageId,
    });
  }

  const allAttachments = parsed.attachments || [];
  const inlineAttachments = allAttachments.filter(isInlineImageAttachment);
  const fileAttachments = allAttachments.filter(isFileAttachment);
  const syncAttachments = [...fileAttachments, ...inlineAttachments];
  const hasAttachments = syncAttachments.length > 0;

  let messageId = existingMsg?.id;

  if (!existingMsg) {
    const bodyHtml = parsed.html || null;
    const { data: insertedMsg, error: msgError } = await sb
      .from("mail_messages")
      .insert({
        thread_id: threadId,
        account_id: account.id,
        org_id: account.org_id,
        provider_message_id: normalizedProviderMessageId || providerMessageId,
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
        has_attachments: hasAttachments,
        send_status: direction === "outbound" ? "sent" : null,
        in_reply_to: parsed.inReplyTo || null,
        raw_headers: {
          "Message-ID": parsed.messageId || providerMessageId,
          imap_uid: rawUid,
          imap_mailbox: mailbox,
        },
      })
      .select("id")
      .single();
    if (msgError) throw msgError;
    messageId = insertedMsg.id;
    await sb
      .from("mail_threads")
      .update({ message_count: (existingThread?.message_count ?? 0) + 1 })
      .eq("id", threadId);
  } else {
    messageId = existingMsg.id;
    const bodyHtml = parsed.html || null;
    await sb
      .from("mail_messages")
      .update({
        provider_message_id: normalizedProviderMessageId || providerMessageId,
        body_html: bodyHtml ?? undefined,
        body_text: parsed.text || null,
        has_attachments: hasAttachments,
        sent_at: sentAt,
        raw_headers: {
          "Message-ID": parsed.messageId || providerMessageId,
          imap_uid: rawUid,
          imap_mailbox: mailbox,
        },
      })
      .eq("id", messageId);
  }

  if (syncAttachments.length > 0 && messageId) {
    await syncImapMessageAttachments(sb, account, messageId, syncAttachments);
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

  let sendResult = { ok: true, smtp_port: smtpPort, message_id: undefined };
  try {
    const info = await transporter.sendMail({
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
    sendResult = {
      ok: true,
      smtp_port: smtpPort,
      message_id: info.messageId
        ? normalizeRfcMessageId(info.messageId)
        : undefined,
    };
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

  return sendResult;
}

const TRASH_FOLDER_CANDIDATES = [
  "Trash",
  "INBOX.Trash",
  "[Gmail]/Trash",
  "Deleted Items",
  "Deleted Messages",
  "Bin",
];
const JUNK_FOLDER_CANDIDATES = [
  "Junk",
  "Spam",
  "INBOX.Spam",
  "[Gmail]/Spam",
  "Junk E-mail",
  "Bulk Mail",
];
const ARCHIVE_FOLDER_CANDIDATES = [
  "Archive",
  "Archives",
  "INBOX.Archive",
  "[Gmail]/All Mail",
];

async function listAllMailboxes(client) {
  const boxes = await client.list();
  const flat = [];
  const walk = (list) => {
    for (const box of list || []) {
      flat.push(box);
      if (box.folders?.length) walk(box.folders);
    }
  };
  walk(boxes);
  return flat;
}

async function resolveMailboxPath(client, candidates, fuzzy) {
  const flat = await listAllMailboxes(client);
  for (const name of candidates) {
    const hit = flat.find(
      (b) => b.path === name || b.name === name || b.path?.endsWith(name),
    );
    if (hit?.path) return hit.path;
  }
  if (fuzzy) {
    const hit = flat.find(fuzzy);
    if (hit?.path) return hit.path;
  }
  return null;
}

async function imapConnectAccount(account) {
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
  await client.connect();
  return client;
}

async function withMailboxLock(client, mailbox, fn) {
  let lock;
  try {
    lock = await client.getMailboxLock(mailbox);
    return await fn();
  } finally {
    lock?.release();
  }
}

async function findUidByMessageId(client, mailboxes, messageId) {
  if (!messageId) return null;
  const needle = String(messageId).replace(/^<|>$/g, "");
  for (const mailbox of mailboxes) {
    try {
      const hit = await withMailboxLock(client, mailbox, async () => {
        const uids = await client.search(
          { header: { "message-id": needle } },
          { uid: true },
        );
        const list = Array.isArray(uids) ? uids : [];
        return list.length ? { mailbox, uid: list[list.length - 1] } : null;
      });
      if (hit) return hit;
    } catch {
      /* try next mailbox */
    }
  }
  return null;
}

async function applyMessageImapAction(client, hit, action) {
  const { mailbox, uid } = hit;
  return withMailboxLock(client, mailbox, async () => {
    switch (action) {
      case "mark_read":
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        return;
      case "mark_unread":
        await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
        return;
      case "star":
        await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
        return;
      case "unstar":
        await client.messageFlagsRemove(uid, ["\\Flagged"], { uid: true });
        return;
      case "delete_forever":
        await client.messageDelete(uid, { uid: true });
        return;
      default:
        throw new Error(`Action ${action} requires folder move`);
    }
  });
}

async function moveMessageImapAction(client, fromMailbox, uid, destPath) {
  if (!destPath) throw new Error("Destination mailbox not found on server");
  return withMailboxLock(client, fromMailbox, async () => {
    await client.messageMove(uid, destPath, { uid: true });
  });
}

async function threadActionAccount(body) {
  const sb = admin();
  const accountId = Number(body.account_id);
  const threadId = Number(body.thread_id);
  const action = String(body.action || "");
  const allowed = [
    "trash",
    "untrash",
    "archive",
    "unarchive",
    "star",
    "unstar",
    "mark_read",
    "mark_unread",
    "spam",
    "not_spam",
    "delete_forever",
  ];
  if (!allowed.includes(action)) throw new Error("Invalid action");

  const { data: account, error: accErr } = await sb
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (accErr || !account) throw new Error("Account not found");
  if (account.provider !== "imap") throw new Error("Not an IMAP account");

  const { data: messages, error: msgErr } = await sb
    .from("mail_messages")
    .select("id, provider_message_id, raw_headers")
    .eq("thread_id", threadId);
  if (msgErr) throw msgErr;
  if (!messages?.length) throw new Error("No messages on thread");

  const client = await imapConnectAccount(account);
  try {
    const trashPath = await resolveMailboxPath(
      client,
      TRASH_FOLDER_CANDIDATES,
      (b) => /trash|deleted|bin/i.test(b.path || b.name || ""),
    );
    const junkPath = await resolveMailboxPath(
      client,
      JUNK_FOLDER_CANDIDATES,
      (b) => /junk|spam/i.test(b.path || b.name || ""),
    );
    const archivePath = await resolveMailboxPath(
      client,
      ARCHIVE_FOLDER_CANDIDATES,
      (b) => /archive|all mail/i.test(b.path || b.name || ""),
    );
    const searchBoxes = [
      "INBOX",
      trashPath,
      junkPath,
      archivePath,
    ].filter(Boolean);

    for (const row of messages) {
      const headers = row.raw_headers || {};
      let mailbox = headers.imap_mailbox || "INBOX";
      let uid = headers.imap_uid;
      if (!uid) {
        const messageId =
          headers["Message-ID"] || row.provider_message_id || null;
        const found = await findUidByMessageId(client, searchBoxes, messageId);
        if (!found) continue;
        mailbox = found.mailbox;
        uid = found.uid;
      }

      const hit = { mailbox, uid };

      if (action === "trash" && trashPath) {
        await moveMessageImapAction(client, mailbox, uid, trashPath);
      } else if (action === "untrash") {
        await moveMessageImapAction(client, mailbox, uid, "INBOX");
      } else if (action === "spam" && junkPath) {
        await moveMessageImapAction(client, mailbox, uid, junkPath);
      } else if (action === "not_spam") {
        await moveMessageImapAction(client, mailbox, uid, "INBOX");
      } else if (action === "archive" && archivePath) {
        await moveMessageImapAction(client, mailbox, uid, archivePath);
      } else if (action === "unarchive") {
        await moveMessageImapAction(client, mailbox, uid, "INBOX");
      } else if (
        action === "mark_read" ||
        action === "mark_unread" ||
        action === "star" ||
        action === "unstar" ||
        action === "delete_forever"
      ) {
        await applyMessageImapAction(client, hit, action);
      } else {
        throw new Error(`IMAP server does not support action: ${action}`);
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { ok: true, account_id: accountId, thread_id: threadId, action };
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
    if (req.method === "POST" && req.url === "/actions") {
      const result = await threadActionAccount(body);
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
