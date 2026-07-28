import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  authenticateMailMember,
  assertAccountAccessAsync,
  getFreshGoogleAccessToken,
  getFreshMicrosoftAccessToken,
  loadMailAccount,
  type MailAccountRow,
} from "../_shared/mailAccount.ts";
import { readWorkerErrorResponse } from "../_shared/formatWorkerError.ts";
import {
  graphMessageFetch,
  handleMicrosoftGraphResponse,
  isBenignMicrosoftMailError,
  resolveMicrosoftThreadMessageIds,
  resolveMicrosoftWellKnownFolderId,
} from "../_shared/microsoftGraphMail.ts";

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type MailAction =
  | "trash"
  | "untrash"
  | "archive"
  | "unarchive"
  | "star"
  | "unstar"
  | "mark_read"
  | "mark_unread"
  | "spam"
  | "not_spam"
  | "delete_forever";

type ThreadRow = {
  id: number;
  account_id: number;
  org_id: number;
  provider_thread_id: string;
  is_trashed: boolean;
  is_archived: boolean;
  is_starred: boolean;
  is_spam: boolean;
  is_unread: boolean;
};

function isLocalProviderId(id: string): boolean {
  return id.startsWith("local-") || id.startsWith("draft-");
}

async function loadThread(threadId: number): Promise<ThreadRow | null> {
  const { data } = await supabaseAdmin
    .from("mail_threads")
    .select(
      "id, account_id, org_id, provider_thread_id, is_trashed, is_archived, is_starred, is_spam, is_unread",
    )
    .eq("id", threadId)
    .maybeSingle();
  return (data as ThreadRow | null) ?? null;
}

async function loadProviderMessageIds(
  threadId: number,
): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("mail_messages")
    .select("provider_message_id")
    .eq("thread_id", threadId);
  return (data ?? [])
    .map((r) => String((r as { provider_message_id: string }).provider_message_id))
    .filter((id) => id && !id.startsWith("local-"));
}

async function deleteThreadFromDatabase(threadId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("mail_threads")
    .delete()
    .eq("id", threadId);
  if (error) throw new Error(error.message);
}

async function applyImapViaWorker(
  accountId: number,
  threadId: number,
  action: MailAction,
): Promise<void> {
  const workerUrl = Deno.env.get("MAIL_IMAP_WORKER_URL")?.trim();
  if (!workerUrl) {
    throw new Error(
      "IMAP actions require MAIL_IMAP_WORKER_URL (mail-imap worker)",
    );
  }
  const workerSecret = Deno.env.get("MAIL_IMAP_WORKER_SECRET")?.trim();
  const res = await fetch(workerUrl.replace(/\/$/, "") + "/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
    },
    body: JSON.stringify({
      account_id: accountId,
      thread_id: threadId,
      action,
    }),
  });
  if (!res.ok) {
    throw new Error(await readWorkerErrorResponse(res));
  }
}

async function applyGoogleAction(
  account: MailAccountRow,
  thread: ThreadRow,
  action: MailAction,
  _messageIds: string[],
): Promise<void> {
  const accessToken = await getFreshGoogleAccessToken(account);
  const threadId = thread.provider_thread_id;

  if (action === "delete_forever") {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ||
          "Gmail delete failed",
      );
    }
    return;
  }

  if (action === "trash") {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/trash`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ||
          "Gmail trash failed",
      );
    }
    return;
  }

  if (action === "untrash") {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/untrash`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ||
          "Gmail untrash failed",
      );
    }
    return;
  }

  const modifyThread = async (add: string[], remove: string[]) => {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addLabelIds: add,
          removeLabelIds: remove,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ||
          "Gmail modify failed",
      );
    }
  };

  switch (action) {
    case "archive":
      await modifyThread([], ["INBOX"]);
      return;
    case "unarchive":
      await modifyThread(["INBOX"], []);
      return;
    case "star":
      await modifyThread(["STARRED"], []);
      return;
    case "unstar":
      await modifyThread([], ["STARRED"]);
      return;
    case "mark_read":
      await modifyThread([], ["UNREAD"]);
      return;
    case "mark_unread":
      await modifyThread(["UNREAD"], []);
      return;
    case "spam":
      await modifyThread(["SPAM"], ["INBOX"]);
      return;
    case "not_spam":
      await modifyThread(["INBOX"], ["SPAM"]);
      return;
    default:
      throw new Error(`Unsupported Gmail action: ${action}`);
  }
}

async function applyMicrosoftAction(
  account: MailAccountRow,
  thread: ThreadRow,
  action: MailAction,
  messageIds: string[],
): Promise<void> {
  const accessToken = await getFreshMicrosoftAccessToken(account);
  const ids = await resolveMicrosoftThreadMessageIds(
    accessToken,
    thread.provider_thread_id,
    messageIds,
  );

  if (ids.length === 0) {
    // Message already removed remotely — allow DB-only cleanup below.
    return;
  }

  const patchMessage = async (messageId: string, body: Record<string, unknown>) => {
    const res = await graphMessageFetch(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    await handleMicrosoftGraphResponse(res, { allowMissing: true });
  };

  const moveMessage = async (messageId: string, destinationId: string) => {
    const resolvedDestination =
      destinationId.includes("/") || destinationId.length > 40
        ? destinationId
        : await resolveMicrosoftWellKnownFolderId(accessToken, destinationId);

    const res = await graphMessageFetch(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}/move`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: resolvedDestination }),
      },
    );
    const moved = await handleMicrosoftGraphResponse(res, { allowMissing: true });
    const nextId = typeof moved?.id === "string" ? moved.id.trim() : "";
    if (nextId && nextId !== messageId) {
      await supabaseAdmin
        .from("mail_messages")
        .update({ provider_message_id: nextId })
        .eq("provider_message_id", messageId);
    }
  };

  const deleteMessage = async (messageId: string) => {
    const res = await graphMessageFetch(
      accessToken,
      `/messages/${encodeURIComponent(messageId)}`,
      { method: "DELETE" },
    );
    await handleMicrosoftGraphResponse(res, { allowMissing: true });
  };

  let hardError: string | null = null;
  for (const messageId of ids) {
    try {
      switch (action) {
        case "delete_forever":
          await deleteMessage(messageId);
          break;
        case "trash":
          await moveMessage(messageId, "deleteditems");
          break;
        case "untrash":
          await moveMessage(messageId, "inbox");
          break;
        case "archive":
          await moveMessage(messageId, "archive");
          break;
        case "unarchive":
          await moveMessage(messageId, "inbox");
          break;
        case "star":
          await patchMessage(messageId, { flag: { flagStatus: "flagged" } });
          break;
        case "unstar":
          await patchMessage(messageId, { flag: { flagStatus: "notFlagged" } });
          break;
        case "mark_read":
          await patchMessage(messageId, { isRead: true });
          break;
        case "mark_unread":
          await patchMessage(messageId, { isRead: false });
          break;
        case "spam":
          await moveMessage(messageId, "junkemail");
          break;
        case "not_spam":
          await moveMessage(messageId, "inbox");
          break;
        default:
          throw new Error(`Unsupported Graph action: ${action}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (isBenignMicrosoftMailError(msg)) continue;
      hardError = msg;
      break;
    }
  }

  if (hardError) throw new Error(hardError);
}

function dbPatchForAction(action: MailAction): Partial<ThreadRow> | null {
  switch (action) {
    case "delete_forever":
      return null;
    case "trash":
      return { is_trashed: true, is_archived: false, is_spam: false };
    case "untrash":
      return { is_trashed: false, is_spam: false };
    case "archive":
      return { is_archived: true, is_trashed: false, is_spam: false };
    case "unarchive":
      return { is_archived: false };
    case "star":
      return { is_starred: true };
    case "unstar":
      return { is_starred: false };
    case "mark_read":
      return { is_unread: false };
    case "mark_unread":
      return { is_unread: true };
    case "spam":
      return { is_spam: true, is_archived: false, is_trashed: false };
    case "not_spam":
      return { is_spam: false };
    default:
      return {};
  }
}

async function applyThreadAction(
  account: MailAccountRow,
  thread: ThreadRow,
  action: MailAction,
): Promise<void> {
  const messageIds = await loadProviderMessageIds(thread.id);
  const localOnly = isLocalProviderId(thread.provider_thread_id);

  if (action === "delete_forever") {
    if (!localOnly && account.provider === "google") {
      await applyGoogleAction(account, thread, action, messageIds);
    } else if (!localOnly && account.provider === "microsoft") {
      await applyMicrosoftAction(account, thread, action, messageIds);
    } else if (account.provider === "imap" && !localOnly) {
      await applyImapViaWorker(account.id, thread.id, action);
    }
    await deleteThreadFromDatabase(thread.id);
    return;
  }

  if (!localOnly && account.provider === "google") {
    await applyGoogleAction(account, thread, action, messageIds);
  } else if (!localOnly && account.provider === "microsoft") {
    await applyMicrosoftAction(account, thread, action, messageIds);
  } else if (account.provider === "imap" && !localOnly) {
    await applyImapViaWorker(account.id, thread.id, action);
  }

  const patch = dbPatchForAction(action);
  if (!patch) return;

  const { error } = await supabaseAdmin
    .from("mail_threads")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", thread.id);
  if (error) throw new Error(error.message);

  if (action === "mark_read" || action === "mark_unread") {
    await supabaseAdmin
      .from("mail_messages")
      .update({ is_read: action === "mark_read" })
      .eq("thread_id", thread.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authenticateMailMember(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  if (auth.member.user_id === "service_role") {
    return json({ error: "Use a user token" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "") as MailAction;
  const valid: MailAction[] = [
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
  if (!valid.includes(action)) {
    return json({ error: "Invalid action" }, 400);
  }

  const threadIdsRaw = body.thread_ids ?? body.thread_id;
  const threadIds: number[] = Array.isArray(threadIdsRaw)
    ? threadIdsRaw.map(Number).filter(Boolean)
    : [Number(threadIdsRaw)].filter(Boolean);
  if (threadIds.length === 0) {
    return json({ error: "thread_id or thread_ids required" }, 400);
  }

  const results: Array<{ thread_id: number; ok: boolean; error?: string }> = [];

  for (const threadId of threadIds) {
    try {
      const thread = await loadThread(threadId);
      if (!thread) throw new Error("Thread not found");
      const account = await loadMailAccount(thread.account_id);
      if (!account || account.org_id !== auth.member.org_id) {
        throw new Error("Not found");
      }
      const denied = await assertAccountAccessAsync(auth.member, account, "view");
      if (denied) throw new Error(denied);
      await applyThreadAction(account, thread, action);
      results.push({ thread_id: threadId, ok: true });
    } catch (e) {
      results.push({
        thread_id: threadId,
        ok: false,
        error: e instanceof Error ? e.message : "Action failed",
      });
    }
  }

  const allOk = results.every((r) => r.ok);
  return json(
    { ok: allOk, results },
    allOk ? 200 : 207,
  );
});
