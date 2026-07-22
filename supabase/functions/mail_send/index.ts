import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  authenticateMailMember,
  assertAccountAccessAsync,
  getFreshGoogleAccessToken,
  getFreshMicrosoftAccessToken,
  loadMailAccount,
  upsertThreadAndMessage,
} from "../_shared/mailAccount.ts";
import { prepareOutboundHtml } from "../_shared/mailOutboundHtml.ts";
import {
  decodeBase64ToBytes,
  storeMailAttachment,
} from "../_shared/mailAttachmentStorage.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

type MailAttachmentIn = {
  filename: string;
  content_type: string;
  content_base64: string;
  size_bytes?: number;
};

function toMimeAddress(email: string) {
  return email.trim();
}

function encodeSubject(subject: string) {
  // Keep ASCII subjects plain; encode UTF-8 subjects for MIME.
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const b64 = btoa(unescape(encodeURIComponent(subject)));
  return `=?UTF-8?B?${b64}?=`;
}

function foldBase64(b64: string) {
  return b64.replace(/.{1,76}/g, (line) => `${line}\r\n`).trimEnd();
}

function sanitizeFilename(name: string) {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 180) || "attachment";
}

function parseAttachments(raw: unknown): MailAttachmentIn[] {
  if (!Array.isArray(raw)) return [];
  const out: MailAttachmentIn[] = [];
  let total = 0;
  for (const item of raw) {
    if (out.length >= MAX_ATTACHMENTS) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const filename = sanitizeFilename(String(row.filename || "attachment"));
    const contentType = String(row.content_type || "application/octet-stream")
      .split(";")[0]
      .trim() || "application/octet-stream";
    const contentBase64 = String(row.content_base64 || "").replace(/\s+/g, "");
    if (!contentBase64) continue;
    const size =
      typeof row.size_bytes === "number" && row.size_bytes > 0
        ? row.size_bytes
        : Math.floor((contentBase64.length * 3) / 4);
    if (size > MAX_FILE_BYTES) {
      throw new Error(
        `Attachment "${filename}" exceeds ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB`,
      );
    }
    total += size;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(
        `Attachments exceed ${Math.floor(MAX_TOTAL_BYTES / (1024 * 1024))} MB total`,
      );
    }
    out.push({
      filename,
      content_type: contentType,
      content_base64: contentBase64,
      size_bytes: size,
    });
  }
  return out;
}

function buildRawMime(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  attachments?: MailAttachmentIn[];
}) {
  const attachments = params.attachments ?? [];
  const altBoundary = `nomi_alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const mixedBoundary = `nomi_mix_${crypto.randomUUID().replace(/-/g, "")}`;
  const text = params.bodyHtml.replace(/<[^>]+>/g, " ");

  const alternative = [
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    params.bodyHtml,
    `--${altBoundary}--`,
  ].join("\r\n");

  const headers = [
    `From: ${params.from}`,
    `To: ${params.to.map(toMimeAddress).join(", ")}`,
    params.cc?.length ? `Cc: ${params.cc.map(toMimeAddress).join(", ")}` : null,
    params.bcc?.length
      ? `Bcc: ${params.bcc.map(toMimeAddress).join(", ")}`
      : null,
    `Subject: ${encodeSubject(params.subject)}`,
    "MIME-Version: 1.0",
    params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : null,
    params.inReplyTo ? `References: ${params.inReplyTo}` : null,
  ].filter(Boolean);

  let body: string;
  if (attachments.length === 0) {
    headers.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    );
    body = alternative;
  } else {
    headers.push(
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    );
    const parts = [
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      alternative,
    ];
    for (const file of attachments) {
      const safeName = sanitizeFilename(file.filename);
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${file.content_type}; name="${safeName}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${safeName}"`,
        "",
        foldBase64(file.content_base64),
      );
    }
    parts.push(`--${mixedBoundary}--`);
    body = parts.join("\r\n");
  }

  const raw = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticateMailMember(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  if (auth.member.user_id === "service_role") {
    return json({ error: "Use a user token to send mail" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const accountId = Number(body.account_id);
  const to = (body.to as string[] | undefined)?.filter(Boolean) ?? [];
  const cc = (body.cc as string[] | undefined)?.filter(Boolean) ?? [];
  const bcc = (body.bcc as string[] | undefined)?.filter(Boolean) ?? [];
  const subject = String(body.subject ?? "");
  const bodyHtmlRaw = String(body.body_html ?? "");
  const draftId = body.draft_id ? Number(body.draft_id) : null;
  const threadId = body.thread_id ? Number(body.thread_id) : null;
  const inReplyTo = body.in_reply_to ? String(body.in_reply_to) : undefined;
  const saveDraft = body.save_draft === true;

  let attachments: MailAttachmentIn[] = [];
  try {
    attachments = parseAttachments(body.attachments);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Invalid attachments" },
      400,
    );
  }

  if (!accountId || (!saveDraft && to.length === 0)) {
    return json({ error: "account_id and to[] required" }, 400);
  }

  const account = await loadMailAccount(accountId);
  if (!account || account.org_id !== auth.member.org_id) {
    return json({ error: "Not found" }, 404);
  }
  const denied = await assertAccountAccessAsync(
    auth.member,
    account,
    saveDraft ? "view" : "send",
  );
  if (denied) return json({ error: denied }, 403);

  if (saveDraft) {
    const draftRow = {
      account_id: account.id,
      org_id: account.org_id,
      owner_member_id: auth.member.id,
      thread_id: threadId,
      to_emails: to,
      cc_emails: cc,
      bcc_emails: bcc,
      subject,
      body_html: bodyHtmlRaw,
      updated_at: new Date().toISOString(),
    };
    if (draftId && Number.isFinite(draftId)) {
      const { data: existing } = await supabaseAdmin
        .from("mail_drafts")
        .select("id")
        .eq("id", draftId)
        .eq("owner_member_id", auth.member.id)
        .eq("account_id", account.id)
        .maybeSingle();
      if (!existing) {
        return json({ error: "Draft not found" }, 404);
      }
      const { error } = await supabaseAdmin
        .from("mail_drafts")
        .update(draftRow)
        .eq("id", draftId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, draft_id: draftId });
    }
    const { data: draft, error } = await supabaseAdmin
      .from("mail_drafts")
      .insert(draftRow)
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, draft_id: draft.id });
  }

  const bodyHtml = prepareOutboundHtml(bodyHtmlRaw);

  try {
    let providerMessageId = `local-${crypto.randomUUID()}`;
    let providerThreadId: string | undefined;

    if (threadId) {
      const { data: th } = await supabaseAdmin
        .from("mail_threads")
        .select("provider_thread_id")
        .eq("id", threadId)
        .maybeSingle();
      const pid = th?.provider_thread_id
        ? String(th.provider_thread_id)
        : "";
      if (pid && !pid.startsWith("local-") && !pid.startsWith("draft-")) {
        providerThreadId = pid;
      }
    }
    if (!providerThreadId) {
      providerThreadId = `local-thread-${crypto.randomUUID()}`;
    }

    let gmailSendThreadId: string | undefined;
    if (
      account.provider === "google" &&
      providerThreadId &&
      !providerThreadId.startsWith("local-")
    ) {
      gmailSendThreadId = providerThreadId;
    }

    if (account.provider === "google") {
      const accessToken = await getFreshGoogleAccessToken(account);
      const raw = buildRawMime({
        from: account.email,
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        inReplyTo,
        attachments,
      });
      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw,
            ...(gmailSendThreadId ? { threadId: gmailSendThreadId } : {}),
          }),
        },
      );
      const sendJson = await sendRes.json();
      if (!sendRes.ok) {
        throw new Error(sendJson.error?.message || "Gmail send failed");
      }
      providerMessageId = String(sendJson.id);
      providerThreadId = String(sendJson.threadId || providerThreadId);
    } else if (account.provider === "microsoft") {
      const accessToken = await getFreshMicrosoftAccessToken(account);
      const sendRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject,
              body: { contentType: "HTML", content: bodyHtml },
              toRecipients: to.map((address) => ({
                emailAddress: { address },
              })),
              ccRecipients: cc.map((address) => ({
                emailAddress: { address },
              })),
              bccRecipients: bcc.map((address) => ({
                emailAddress: { address },
              })),
              attachments: attachments.map((file) => ({
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: file.filename,
                contentType: file.content_type,
                contentBytes: file.content_base64,
              })),
            },
            saveToSentItems: true,
          }),
        },
      );
      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.error?.message || "Graph send failed");
      }
    } else if (account.provider === "imap") {
      const workerUrl = Deno.env.get("MAIL_IMAP_WORKER_URL")?.trim();
      if (!workerUrl) {
        throw new Error(
          "IMAP send requires MAIL_IMAP_WORKER_URL (SMTP worker)",
        );
      }
      const workerSecret = Deno.env.get("MAIL_IMAP_WORKER_SECRET")?.trim();
      const res = await fetch(workerUrl.replace(/\/$/, "") + "/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
        },
        body: JSON.stringify({
          account_id: account.id,
          to,
          cc,
          bcc,
          subject,
          body_html: bodyHtml,
          attachments: attachments.map((file) => ({
            filename: file.filename,
            content_type: file.content_type,
            content_base64: file.content_base64,
          })),
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let detail = raw || "IMAP/SMTP send failed";
        try {
          const parsed = JSON.parse(raw) as { error?: string };
          if (parsed.error) detail = parsed.error;
        } catch {
          /* keep raw */
        }
        throw new Error(detail);
      }
    } else {
      throw new Error("Unsupported provider");
    }

    const upserted = await upsertThreadAndMessage({
      account,
      providerThreadId: providerThreadId!,
      providerMessageId,
      subject,
      snippet: bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 160),
      fromEmail: account.email.toLowerCase(),
      fromName: account.email,
      toEmails: to,
      ccEmails: cc,
      bodyHtml,
      bodyText: bodyHtml.replace(/<[^>]+>/g, " "),
      sentAt: new Date().toISOString(),
      isUnread: false,
      direction: "outbound",
      hasAttachments: attachments.length > 0,
      inReplyTo: inReplyTo ?? null,
    });

    if (attachments.length > 0 && upserted.messageId) {
      for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        const bytes = decodeBase64ToBytes(file.content_base64);
        const providerId = `outbound-${i}-${file.filename}`;
        await storeMailAttachment({
          orgId: account.org_id,
          accountId: account.id,
          messageId: upserted.messageId,
          providerAttachmentId: providerId,
          filename: file.filename,
          mimeType: file.content_type,
          bytes,
        });
      }
    }

    if (draftId && Number.isFinite(draftId)) {
      await supabaseAdmin
        .from("mail_drafts")
        .delete()
        .eq("id", draftId)
        .eq("owner_member_id", auth.member.id);
    }

    return json({ ok: true, provider_message_id: providerMessageId });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Send failed" },
      500,
    );
  }
});
