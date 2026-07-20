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
} from "../_shared/mailAccount.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

function toMimeAddress(email: string) {
  return email.trim();
}

function buildRawMime(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
}) {
  const boundary = `nomi_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${params.from}`,
    `To: ${params.to.map(toMimeAddress).join(", ")}`,
    params.cc?.length ? `Cc: ${params.cc.map(toMimeAddress).join(", ")}` : null,
    params.bcc?.length
      ? `Bcc: ${params.bcc.map(toMimeAddress).join(", ")}`
      : null,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : null,
    params.inReplyTo ? `References: ${params.inReplyTo}` : null,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const text = params.bodyHtml.replace(/<[^>]+>/g, " ");
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    params.bodyHtml,
    `--${boundary}--`,
  ].join("\r\n");

  const raw = `${headers}\r\n\r\n${body}`;
  // Gmail expects URL-safe base64
  const b64 = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return b64;
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
  const bodyHtml = String(body.body_html ?? "");
  const threadId = body.thread_id ? Number(body.thread_id) : null;
  const inReplyTo = body.in_reply_to ? String(body.in_reply_to) : undefined;
  const saveDraft = body.save_draft === true;

  if (!accountId || (!saveDraft && to.length === 0)) {
    return json({ error: "account_id and to[] required" }, 400);
  }

  const account = await loadMailAccount(accountId);
  if (!account || account.org_id !== auth.member.org_id) {
    return json({ error: "Not found" }, 404);
  }
  const denied = assertAccountAccess(
    auth.member,
    account,
    saveDraft ? "view" : "send",
  );
  if (denied) return json({ error: denied }, 403);

  if (saveDraft) {
    const { data: draft, error } = await supabaseAdmin
      .from("mail_drafts")
      .insert({
        account_id: account.id,
        org_id: account.org_id,
        owner_member_id: auth.member.id,
        thread_id: threadId,
        to_emails: to,
        cc_emails: cc,
        bcc_emails: bcc,
        subject,
        body_html: bodyHtml,
      })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, draft_id: draft.id });
  }

  try {
    let providerMessageId = `local-${crypto.randomUUID()}`;
    let providerThreadId = threadId
      ? undefined
      : `local-thread-${crypto.randomUUID()}`;

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
      });
      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
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

    if (!providerThreadId && threadId) {
      const { data: th } = await supabaseAdmin
        .from("mail_threads")
        .select("provider_thread_id")
        .eq("id", threadId)
        .maybeSingle();
      providerThreadId = th?.provider_thread_id ?? `local-${threadId}`;
    }

    await upsertThreadAndMessage({
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
    });

    return json({ ok: true, provider_message_id: providerMessageId });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Send failed" },
      500,
    );
  }
});
