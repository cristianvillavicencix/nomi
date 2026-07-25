import { supabaseAdmin } from "./supabaseAdmin.ts";
import { microsoftMailOAuthScopeString } from "./microsoftMailOAuth.ts";
import { getUserOrganizationMember } from "./getUserOrganizationMember.ts";
import {
  assertOrgMailAccountAccess,
  loadMailAccountShare,
  memberIsOrgMailAdmin,
} from "./mailAccountShare.ts";

export type MailMember = {
  id: number;
  org_id: number;
  administrator: boolean | null;
  user_id: string;
  module_permissions?: Record<string, unknown> | null;
};

export type MailAccountRow = {
  id: number;
  org_id: number;
  owner_member_id: number | null;
  provider: "google" | "microsoft" | "imap";
  email: string;
  status: string;
  token_payload: Record<string, unknown>;
  imap_host: string | null;
  imap_port: number | null;
  imap_username: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  sync_cursor: Record<string, unknown>;
  scopes: string[] | null;
};

export async function authenticateMailMember(
  req: Request,
): Promise<{ member: MailMember } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.slice(7);
  // Internal service-role calls (cron / post-oauth)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (token === serviceKey) {
    return {
      member: {
        id: 0,
        org_id: 0,
        administrator: true,
        user_id: "service_role",
      },
    };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Unauthorized", status: 401 };
  const member = (await getUserOrganizationMember(data.user)) as MailMember | null;
  if (!member) return { error: "Forbidden", status: 403 };
  return { member };
}

export function memberHasCapability(
  member: MailMember,
  capability: string,
): boolean {
  if (member.administrator) return true;
  if (member.user_id === "service_role") return true;
  const perms = member.module_permissions;
  if (!perms || typeof perms !== "object") return false;
  // Flatten common shapes: { caps: string[] } | { [cap]: true } | string[]
  if (Array.isArray(perms)) return perms.includes(capability);
  if (Array.isArray((perms as { capabilities?: unknown }).capabilities)) {
    return ((perms as { capabilities: string[] }).capabilities).includes(
      capability,
    );
  }
  const val = (perms as Record<string, unknown>)[capability];
  return val === true || val === "allow" || val === "write";
}

export async function loadMailAccount(
  accountId: number,
): Promise<MailAccountRow | null> {
  const { data } = await supabaseAdmin
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  return (data as MailAccountRow | null) ?? null;
}

export function assertAccountAccess(
  member: MailMember,
  account: MailAccountRow,
  mode: "view" | "send" | "manage",
): string | null {
  if (member.user_id === "service_role") return null;
  if (account.org_id !== member.org_id) return "Forbidden";
  const isPersonal = account.owner_member_id != null;
  if (isPersonal) {
    if (account.owner_member_id !== member.id && mode !== "manage") {
      if (!(mode === "manage" && member.administrator)) {
        return "Forbidden";
      }
    }
    const cap =
      mode === "view"
        ? "mail.personal.view"
        : mode === "send"
        ? "mail.personal.send"
        : "mail.personal.manage";
    if (!memberHasCapability(member, cap) && !member.administrator) {
      return "Forbidden";
    }
    return null;
  }
  return null;
}

export async function assertAccountAccessAsync(
  member: MailMember,
  account: MailAccountRow,
  mode: "view" | "send" | "manage",
): Promise<string | null> {
  if (member.user_id === "service_role") return null;
  if (account.org_id !== member.org_id) return "Forbidden";
  const isPersonal = account.owner_member_id != null;
  if (isPersonal) {
    return assertAccountAccess(member, account, mode);
  }
  return assertOrgMailAccountAccess(member, account, mode);
}

export { loadMailAccountShare, memberIsOrgMailAdmin };

export async function getFreshGoogleAccessToken(
  account: MailAccountRow,
): Promise<string> {
  const payload = account.token_payload ?? {};
  const expiresAt = payload.expires_at
    ? new Date(String(payload.expires_at)).getTime()
    : 0;
  if (
    payload.access_token &&
    expiresAt > Date.now() + 60_000
  ) {
    return String(payload.access_token);
  }
  const refresh = String(payload.refresh_token || "");
  if (!refresh) throw new Error("Missing Google refresh token — reconnect");
  const clientId = Deno.env.get("MAIL_GOOGLE_CLIENT_ID") ||
    Deno.env.get("GOOGLE_GSC_CLIENT_ID");
  const clientSecret = Deno.env.get("MAIL_GOOGLE_CLIENT_SECRET") ||
    Deno.env.get("GOOGLE_GSC_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google Mail OAuth not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    await supabaseAdmin
      .from("mail_accounts")
      .update({
        status: "needs_reconnect",
        error_message: json.error_description || "Token refresh failed",
      })
      .eq("id", account.id);
    throw new Error(json.error_description || "Google token refresh failed");
  }
  const next = {
    ...payload,
    access_token: json.access_token,
    expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
  await supabaseAdmin
    .from("mail_accounts")
    .update({ token_payload: next, status: "connected", error_message: null })
    .eq("id", account.id);
  return String(json.access_token);
}

export async function getFreshMicrosoftAccessToken(
  account: MailAccountRow,
): Promise<string> {
  const payload = account.token_payload ?? {};
  const expiresAt = payload.expires_at
    ? new Date(String(payload.expires_at)).getTime()
    : 0;
  if (payload.access_token && expiresAt > Date.now() + 60_000) {
    return String(payload.access_token);
  }
  const refresh = String(payload.refresh_token || "");
  if (!refresh) throw new Error("Missing Microsoft refresh token — reconnect");
  const clientId = Deno.env.get("MAIL_MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MAIL_MICROSOFT_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft Mail OAuth not configured");
  }
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
        scope: microsoftMailOAuthScopeString(),
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    await supabaseAdmin
      .from("mail_accounts")
      .update({
        status: "needs_reconnect",
        error_message: json.error_description || "Token refresh failed",
      })
      .eq("id", account.id);
    throw new Error(json.error_description || "Microsoft token refresh failed");
  }
  const next = {
    ...payload,
    access_token: json.access_token,
    refresh_token: json.refresh_token || refresh,
    expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
  await supabaseAdmin
    .from("mail_accounts")
    .update({ token_payload: next, status: "connected", error_message: null })
    .eq("id", account.id);
  return String(json.access_token);
}

async function recomputeThreadUnread(threadId: number): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from("mail_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  const { error: updateError } = await supabaseAdmin
    .from("mail_threads")
    .update({ is_unread: (count ?? 0) > 0 })
    .eq("id", threadId);
  if (updateError) throw new Error(updateError.message);
}

function shouldAdvanceThreadLastMessageAt(
  currentLastMessageAt: string | null | undefined,
  messageSentAt: string | null,
): boolean {
  if (!messageSentAt) return false;
  const messageTime = new Date(messageSentAt).getTime();
  if (!Number.isFinite(messageTime)) return false;
  if (!currentLastMessageAt) return true;
  const currentTime = new Date(String(currentLastMessageAt)).getTime();
  if (!Number.isFinite(currentTime)) return true;
  return messageTime >= currentTime;
}

export async function upsertThreadAndMessage(params: {
  account: MailAccountRow;
  providerThreadId: string;
  providerMessageId: string;
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: string | null;
  isUnread: boolean;
  direction: "inbound" | "outbound";
  hasAttachments?: boolean;
  isTrashed?: boolean;
  isSpam?: boolean;
  isStarred?: boolean;
  rfcMessageId?: string | null;
  inReplyTo?: string | null;
}) {
  const { account } = params;
  const participants = [
    ...(params.fromEmail
      ? [{ email: params.fromEmail, name: params.fromName ?? undefined }]
      : []),
    ...params.toEmails.map((email) => ({ email })),
  ];

  const { data: existingThread } = await supabaseAdmin
    .from("mail_threads")
    .select("id, message_count, last_message_at")
    .eq("account_id", account.id)
    .eq("provider_thread_id", params.providerThreadId)
    .maybeSingle();

  let threadId = existingThread?.id as number | undefined;
  const threadPatch: Record<string, unknown> = {
    subject: params.subject,
    snippet: params.snippet,
    participants,
    updated_at: new Date().toISOString(),
  };
  if (
    shouldAdvanceThreadLastMessageAt(
      existingThread?.last_message_at as string | null | undefined,
      params.sentAt,
    )
  ) {
    threadPatch.last_message_at = params.sentAt;
  } else if (!threadId) {
    threadPatch.last_message_at = params.sentAt;
  }
  if (params.isTrashed === true) threadPatch.is_trashed = true;
  else if (params.isTrashed === false) threadPatch.is_trashed = false;
  if (params.isSpam === true) threadPatch.is_spam = true;
  else if (params.isSpam === false) threadPatch.is_spam = false;
  if (params.isStarred === true) threadPatch.is_starred = true;
  else if (params.isStarred === false) threadPatch.is_starred = false;

  if (threadId) {
    await supabaseAdmin.from("mail_threads").update(threadPatch).eq("id", threadId);
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("mail_threads")
      .insert({
        account_id: account.id,
        org_id: account.org_id,
        provider_thread_id: params.providerThreadId,
        subject: params.subject,
        snippet: params.snippet,
        participants,
        last_message_at: params.sentAt,
        is_unread: params.isUnread,
        is_trashed: params.isTrashed ?? false,
        is_spam: params.isSpam ?? false,
        is_starred: params.isStarred ?? false,
        message_count: 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    threadId = inserted.id;
  }

  const { data: existingMsg } = await supabaseAdmin
    .from("mail_messages")
    .select("id, is_read")
    .eq("account_id", account.id)
    .eq("provider_message_id", params.providerMessageId)
    .maybeSingle();

  const headerPatch: Record<string, string> = {};
  if (params.rfcMessageId) headerPatch["Message-ID"] = params.rfcMessageId;
  if (params.inReplyTo) headerPatch["In-Reply-To"] = params.inReplyTo;

  if (!existingMsg) {
    const { data: insertedMsg, error: msgError } = await supabaseAdmin
      .from("mail_messages")
      .insert({
        thread_id: threadId,
        account_id: account.id,
        org_id: account.org_id,
        provider_message_id: params.providerMessageId,
        direction: params.direction,
        from_email: params.fromEmail,
        from_name: params.fromName,
        to_emails: params.toEmails,
        cc_emails: params.ccEmails,
        subject: params.subject,
        body_html: params.bodyHtml,
        body_text: params.bodyText,
        sent_at: params.sentAt,
        is_read: !params.isUnread,
        has_attachments: params.hasAttachments ?? false,
        send_status: params.direction === "outbound" ? "sent" : null,
        in_reply_to: params.inReplyTo ?? null,
        raw_headers:
          Object.keys(headerPatch).length > 0 ? headerPatch : undefined,
      })
      .select("id")
      .single();
    if (msgError) throw new Error(msgError.message);
    await supabaseAdmin
      .from("mail_threads")
      .update({
        message_count: (existingThread?.message_count ?? 0) + 1,
      })
      .eq("id", threadId);
    await recomputeThreadUnread(threadId!);
    return {
      threadId: threadId!,
      messageId: insertedMsg.id as number,
      messageCreated: true,
    };
  } else {
    // Refresh bodies on re-sync (fixes UTF-8 / provider content updates).
    const msgPatch: Record<string, unknown> = {
      subject: params.subject,
      body_html: params.bodyHtml,
      body_text: params.bodyText,
      from_email: params.fromEmail,
      from_name: params.fromName,
      to_emails: params.toEmails,
      cc_emails: params.ccEmails,
      has_attachments: params.hasAttachments ?? false,
      in_reply_to: params.inReplyTo ?? undefined,
      raw_headers:
        Object.keys(headerPatch).length > 0 ? headerPatch : undefined,
    };
    const locallyRead = existingMsg.is_read === true;
    if (!(locallyRead && params.isUnread)) {
      msgPatch.is_read = !params.isUnread;
    }
    await supabaseAdmin
      .from("mail_messages")
      .update(msgPatch)
      .eq("id", existingMsg.id);
    await recomputeThreadUnread(threadId!);
    return {
      threadId: threadId!,
      messageId: existingMsg.id as number,
      messageCreated: false,
    };
  }
}
