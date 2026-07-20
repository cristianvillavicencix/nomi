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
  const json = (await res.json()) as {
    ok?: boolean;
    synced?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "Sync failed");
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
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Send failed");
  return json;
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
