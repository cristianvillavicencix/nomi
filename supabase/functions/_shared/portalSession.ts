import { supabaseAdmin } from "./supabaseAdmin.ts";

export const PORTAL_LOGIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SENSITIVE_SESSION_TTL_MS = 5 * 60 * 1000;

export const loadPortalSession = async (
  portalAccountId: number,
  sessionToken: string,
) => {
  const { data: session, error } = await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .select("id, expires_at")
    .eq("portal_account_id", portalAccountId)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session?.id) return null;
  if (new Date(String(session.expires_at)).getTime() < Date.now()) {
    await supabaseAdmin
      .from("client_portal_sensitive_sessions")
      .delete()
      .eq("id", session.id);
    return null;
  }
  return session;
};

export const endPortalSession = async (
  portalAccountId: number,
  sessionToken: string,
) => {
  await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .delete()
    .eq("portal_account_id", portalAccountId)
    .eq("session_token", sessionToken);
};
