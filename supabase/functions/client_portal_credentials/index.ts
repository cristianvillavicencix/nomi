import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type ClientPortalCredentialsBody = {
  token?: string;
  action?: "start_sensitive_session" | "reveal_password" | "log_copy";
  email_confirm?: string;
  sensitive_session?: string;
  deal_id?: number;
  entry_id?: number;
  kind?: "login" | "api_key" | string | null;
};

const SENSITIVE_SESSION_TTL_MS = 5 * 60 * 1000;

const getPgcryptoKey = () => {
  const key = Deno.env.get("PGCRYPTO_KEY")?.trim();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured");
  }
  return key;
};

const getClientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  null;

const randomSessionToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const resolvePortalAccount = async (token: string) => {
  const { data: account, error } = await supabaseAdmin
    .from("client_portal_accounts")
    .select("id, org_id, email, active")
    .eq("invitation_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!account?.id) return null;
  return account;
};

const assertDealAccess = async (
  portalAccountId: number,
  orgId: number,
  dealId: number,
) => {
  const { data: access } = await supabaseAdmin
    .from("client_portal_deal_access")
    .select("deal_id")
    .eq("portal_account_id", portalAccountId)
    .eq("deal_id", dealId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!access?.deal_id) {
    throw new Error("Project not shared with this client");
  }

  const { data: delivery } = await supabaseAdmin
    .from("project_deliveries")
    .select("id")
    .eq("deal_id", dealId)
    .eq("org_id", orgId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!delivery?.id) {
    throw new Error("Project has not been delivered yet");
  }
};

const loadSensitiveSession = async (
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
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("client_portal_sensitive_sessions")
      .delete()
      .eq("id", session.id);
    return null;
  }
  return session;
};

const loadSharedEntry = async (
  orgId: number,
  dealId: number,
  entryId: number,
) => {
  const { data: entry, error } = await supabaseAdmin
    .from("deal_access_entries")
    .select(
      "id, org_id, deal_id, label, url, username, has_password, shared_with_client",
    )
    .eq("id", entryId)
    .eq("deal_id", dealId)
    .eq("org_id", orgId)
    .eq("shared_with_client", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!entry?.id) {
    throw new Error("Credential not found or not shared with client");
  }
  return entry;
};

const loadSharedSecret = async (orgId: number, dealId: number, secretId: number) => {
  const { data: secret, error } = await supabaseAdmin
    .from("deal_secrets")
    .select("id, org_id, deal_id, label, has_secret, shared_with_client")
    .eq("id", secretId)
    .eq("deal_id", dealId)
    .eq("org_id", orgId)
    .eq("shared_with_client", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!secret?.id) {
    throw new Error("Credential not found or not shared with client");
  }
  return secret;
};

const insertClientCredentialAudit = async (params: {
  orgId: number;
  dealId: number;
  entryId?: number | null;
  secretId?: number | null;
  portalAccountId: number;
  action: "view" | "copy";
  req: Request;
}) => {
  const { error } = await supabaseAdmin.from("client_credential_access_log").insert({
    org_id: params.orgId,
    deal_id: params.dealId,
    access_entry_id: params.entryId ?? null,
    secret_id: params.secretId ?? null,
    portal_account_id: params.portalAccountId,
    action: params.action,
    ip_address: getClientIp(params.req),
    user_agent: params.req.headers.get("user-agent"),
  });
  if (error) throw new Error(error.message);
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as ClientPortalCredentialsBody;
      const token = body.token?.trim();
      if (!token) {
        return createErrorResponse(400, "Missing portal token");
      }

      const account = await resolvePortalAccount(token);
      if (!account) {
        return createErrorResponse(403, "Invalid or expired portal link");
      }

      const action = body.action ?? "start_sensitive_session";

      if (action === "start_sensitive_session") {
        const emailConfirm = body.email_confirm?.trim().toLowerCase();
        const accountEmail = account.email?.trim().toLowerCase();
        if (!emailConfirm || emailConfirm !== accountEmail) {
          return createErrorResponse(403, "Email confirmation does not match");
        }

        await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .delete()
          .eq("portal_account_id", account.id)
          .lt("expires_at", new Date().toISOString());

        const sessionToken = randomSessionToken();
        const expiresAt = new Date(Date.now() + SENSITIVE_SESSION_TTL_MS).toISOString();

        const { error: insertError } = await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .insert({
            portal_account_id: account.id,
            session_token: sessionToken,
            expires_at: expiresAt,
            ip_address: getClientIp(req),
            user_agent: req.headers.get("user-agent"),
          });

        if (insertError) throw new Error(insertError.message);

        return new Response(
          JSON.stringify({
            ok: true,
            sensitive_session: sessionToken,
            expires_at: expiresAt,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const sensitiveSession = body.sensitive_session?.trim();
      if (!sensitiveSession) {
        return createErrorResponse(401, "Sensitive session required");
      }

      const session = await loadSensitiveSession(account.id, sensitiveSession);
      if (!session) {
        return createErrorResponse(401, "Sensitive session expired. Confirm your email again.");
      }

      const dealId = Number(body.deal_id);
      const entryId = Number(body.entry_id);
      if (!Number.isFinite(dealId) || !Number.isFinite(entryId)) {
        return createErrorResponse(400, "deal_id and entry_id are required");
      }

      await assertDealAccess(account.id, account.org_id, dealId);
      const kind = (body.kind ?? "login") === "api_key" ? "api_key" : "login";
      const entry =
        kind === "api_key"
          ? await loadSharedSecret(account.org_id, dealId, entryId)
          : await loadSharedEntry(account.org_id, dealId, entryId);

      if (action === "log_copy") {
        await insertClientCredentialAudit({
          orgId: account.org_id,
          dealId,
          entryId: kind === "login" ? entryId : null,
          secretId: kind === "api_key" ? entryId : null,
          portalAccountId: account.id,
          action: "copy",
          req,
        });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "reveal_password") {
        const cryptoKey = getPgcryptoKey();
        const hasPassword =
          kind === "api_key" ? Boolean((entry as { has_secret?: boolean }).has_secret) : Boolean((entry as { has_password?: boolean }).has_password);
        if (!hasPassword) {
          return new Response(JSON.stringify({ password: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: password, error: getError } =
          kind === "api_key"
            ? await supabaseAdmin.rpc("get_deal_secret_value", {
                p_secret_id: entryId,
                p_key: cryptoKey,
              })
            : await supabaseAdmin.rpc("get_access_entry_password", {
                p_entry_id: entryId,
                p_key: cryptoKey,
              });
        if (getError) throw new Error(getError.message);

        await insertClientCredentialAudit({
          orgId: account.org_id,
          dealId,
          entryId: kind === "login" ? entryId : null,
          secretId: kind === "api_key" ? entryId : null,
          portalAccountId: account.id,
          action: "view",
          req,
        });

        return new Response(JSON.stringify({ password: password ?? null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return createErrorResponse(400, "Invalid action");
    } catch (error) {
      console.error("client_portal_credentials.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
