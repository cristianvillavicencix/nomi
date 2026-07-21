import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

const functionsBase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  return `${url.replace(/\/$/, "")}/functions/v1`;
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const apikey =
    (import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!apikey) throw new Error("Supabase publishable key is not configured");
  return {
    Authorization: `Bearer ${token}`,
    apikey,
    "Content-Type": "application/json",
  };
}

export async function startMailOAuth(params: {
  provider: "google" | "microsoft";
  scope: "org" | "personal";
}) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_oauth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "start", ...params }),
  });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? "Could not start mailbox connection");
  }
  window.location.assign(json.url);
}

export async function disconnectMailAccount(accountId: number) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_oauth`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "disconnect", account_id: accountId }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Disconnect failed");
}

export async function syncMailAccount(
  accountId: number,
  range?: { since: string | null; max_results: number },
) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      account_id: accountId,
      since: range?.since ?? undefined,
      max_results: range?.max_results ?? 200,
    }),
  });
  const raw = await res.text();
  let json: { ok?: boolean; synced?: number; error?: string } = {};
  try {
    json = raw ? (JSON.parse(raw) as typeof json) : {};
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const detail =
      json.error ||
      (raw.trim() && raw.length < 500 ? raw.trim() : null) ||
      `Sync failed (${res.status})`;
    throw new Error(detail);
  }
  return json;
}

export type MailThreadAction =
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

export async function applyMailThreadAction(
  threadIds: number | number[],
  action: MailThreadAction,
) {
  const headers = await authHeaders();
  const ids = Array.isArray(threadIds) ? threadIds : [threadIds];
  const res = await fetch(`${functionsBase()}/mail_actions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, thread_ids: ids }),
  });
  const raw = await res.text();
  let json: {
    ok?: boolean;
    error?: string;
    results?: Array<{ thread_id: number; ok: boolean; error?: string }>;
  } = {};
  try {
    json = raw ? (JSON.parse(raw) as typeof json) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(
      json.error ||
        (raw.trim() && raw.length < 500 ? raw.trim() : null) ||
        `Action failed (${res.status})`,
    );
  }
  const failed = json.results?.filter((r) => !r.ok) ?? [];
  if (failed.length > 0) {
    throw new Error(failed[0]?.error ?? "Action failed");
  }
  return json;
}

export async function sendMailMessage(payload: {
  account_id: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html: string;
  thread_id?: number;
  in_reply_to?: string;
  save_draft?: boolean;
  draft_id?: number;
  attachments?: Array<{
    filename: string;
    content_type: string;
    content_base64: string;
    size_bytes?: number;
  }>;
}) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_send`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    draft_id?: number;
  };
  if (!res.ok) throw new Error(json.error ?? "Send failed");
  return json;
}

export async function deleteMailDraft(draftId: number) {
  const { error } = await supabase
    .from("mail_drafts")
    .delete()
    .eq("id", draftId);
  if (error) throw new Error(error.message);
}

export async function testAndSaveImapAccount(payload: {
  scope: "org" | "personal";
  email: string;
  password: string;
  display_name?: string;
  imap_host?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_port?: number;
  mail_provider?: string;
}) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_imap`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "connect", ...payload }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    account_id?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "Could not connect IMAP account");
  return json;
}
