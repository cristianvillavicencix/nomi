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

export type MailAccountShare = {
  member_id: number;
  can_view: boolean;
  can_send: boolean;
  granted_by_member_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export async function getMailAccountShares(accountId: number) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_account_shares`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "get", account_id: accountId }),
  });
  const json = (await res.json()) as {
    shares?: MailAccountShare[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "Failed to load shares");
  return json.shares ?? [];
}

export async function setMailAccountShares(
  accountId: number,
  shares: Array<Pick<MailAccountShare, "member_id" | "can_view" | "can_send">>,
) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase()}/mail_account_shares`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "set", account_id: accountId, shares }),
  });
  const json = (await res.json()) as {
    shares?: MailAccountShare[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? "Failed to save shares");
  return json.shares ?? [];
}
