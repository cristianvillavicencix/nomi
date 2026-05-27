import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type ClientPortalCredentialsBody = {
  token?: string;
  action?:
    | "request_sensitive_code"
    | "verify_sensitive_code"
    | "start_sensitive_session"
    | "reveal_password"
    | "log_copy";
  email_confirm?: string;
  code?: string;
  sensitive_session?: string;
  deal_id?: number;
  entry_id?: number;
  kind?: "login" | "api_key" | string | null;
};

const SENSITIVE_SESSION_TTL_MS = 5 * 60 * 1000;
const SENSITIVE_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 8;

const getPostmarkServerToken = () => Deno.env.get("POSTMARK_SERVER_TOKEN")?.trim();
const getPostmarkFromEmail = () => Deno.env.get("POSTMARK_FROM_EMAIL")?.trim();

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sha256Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const sendOtpEmail = async (to: string, code: string) => {
  const token = getPostmarkServerToken();
  const from = getPostmarkFromEmail();
  if (!token || !from) {
    throw new Error("Email provider is not configured");
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: "Your Nomi verification code",
      TextBody: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to send verification email (${res.status}) ${text}`);
  }
};

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

const loadLatestOtpChallenge = async (portalAccountId: number) => {
  const { data: challenge, error } = await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .select("id, otp_code_hash, otp_expires_at, otp_attempts")
    .eq("portal_account_id", portalAccountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return challenge ?? null;
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

      if (action === "request_sensitive_code" || action === "start_sensitive_session") {
        const accountEmail = account.email?.trim();
        if (!accountEmail) {
          return createErrorResponse(400, "Account email not found");
        }

        // Purge expired sessions and old challenges.
        await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .delete()
          .eq("portal_account_id", account.id)
          .or(
            `expires_at.lt.${new Date().toISOString()},otp_expires_at.lt.${new Date().toISOString()}`,
          );

        const code = generateOtpCode();
        const codeHash = await sha256Hex(code);
        const otpExpiresAt = new Date(Date.now() + SENSITIVE_CODE_TTL_MS).toISOString();

        // Store challenge row (session token will be created on verify).
        const { error: insertError } = await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .insert({
            portal_account_id: account.id,
            session_token: randomSessionToken(),
            expires_at: new Date(Date.now() + SENSITIVE_SESSION_TTL_MS).toISOString(),
            otp_code_hash: codeHash,
            otp_expires_at: otpExpiresAt,
            otp_sent_at: new Date().toISOString(),
            otp_attempts: 0,
            ip_address: getClientIp(req),
            user_agent: req.headers.get("user-agent"),
          });

        if (insertError) throw new Error(insertError.message);

        await sendOtpEmail(accountEmail, code);

        return new Response(
          JSON.stringify({ ok: true, sent: true, expires_at: otpExpiresAt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "verify_sensitive_code") {
        const code = body.code?.trim();
        if (!code || !/^\d{6}$/.test(code)) {
          return createErrorResponse(400, "Invalid code");
        }

        const challenge = await loadLatestOtpChallenge(account.id);
        if (
          !challenge?.id ||
          !challenge.otp_code_hash ||
          !challenge.otp_expires_at
        ) {
          return createErrorResponse(401, "Verification code required");
        }
        if (challenge.otp_attempts != null && Number(challenge.otp_attempts) >= MAX_OTP_ATTEMPTS) {
          return createErrorResponse(429, "Too many attempts. Request a new code.");
        }
        if (new Date(String(challenge.otp_expires_at)).getTime() < Date.now()) {
          return createErrorResponse(401, "Code expired. Request a new code.");
        }

        const codeHash = await sha256Hex(code);
        const nextAttempts = Number(challenge.otp_attempts ?? 0) + 1;

        if (codeHash !== String(challenge.otp_code_hash)) {
          await supabaseAdmin
            .from("client_portal_sensitive_sessions")
            .update({ otp_attempts: nextAttempts })
            .eq("id", challenge.id);
          return createErrorResponse(401, "Invalid code");
        }

        // Create session token by reusing the row's session_token, but mark OTP as consumed.
        const { data: sessionRow, error: sessionError } = await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .select("session_token, expires_at")
          .eq("id", challenge.id)
          .maybeSingle();
        if (sessionError) throw new Error(sessionError.message);
        if (!sessionRow?.session_token || !sessionRow.expires_at) {
          return createErrorResponse(500, "Session not found");
        }

        await supabaseAdmin
          .from("client_portal_sensitive_sessions")
          .update({
            otp_code_hash: null,
            otp_expires_at: null,
            otp_attempts: nextAttempts,
          })
          .eq("id", challenge.id);

        return new Response(
          JSON.stringify({
            ok: true,
            sensitive_session: String(sessionRow.session_token),
            expires_at: String(sessionRow.expires_at),
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
