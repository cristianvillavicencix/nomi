import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  endPortalSession,
  loadPortalSession,
  PORTAL_LOGIN_SESSION_TTL_MS,
  SENSITIVE_SESSION_TTL_MS,
} from "../_shared/portalSession.ts";
import { sendTransactionalEmail } from "../_shared/transactionalEmail.ts";
import { resolveOrgGeneralFrom } from "../_shared/organizationEmailSenders.ts";
import { isPortalMasterCode } from "../_shared/portalMasterCode.ts";

type ClientPortalCredentialsBody = {
  token?: string;
  email?: string;
  action?:
    | "request_sensitive_code"
    | "verify_sensitive_code"
    | "start_sensitive_session"
    | "request_portal_login_code"
    | "verify_portal_login_code"
    | "request_email_login_code"
    | "verify_email_login_code"
    | "end_portal_session"
    | "reveal_password"
    | "log_copy";
  email_confirm?: string;
  code?: string;
  sensitive_session?: string;
  deal_id?: number;
  entry_id?: number;
  kind?: "login" | "api_key" | string | null;
  portal_session?: string;
  purpose?: "portal" | "credentials";
};

const SENSITIVE_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 8;

const generateOtpCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const sha256Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const sendOtpEmail = async (orgId: number, to: string, code: string) => {
  const generalFrom = await resolveOrgGeneralFrom(orgId);
  await sendTransactionalEmail({
    orgId,
    to,
    subject: "Your Latino Business Support verification code",
    textBody: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    fromEmail: generalFrom.email,
    fromName: generalFrom.name,
    replyTo: generalFrom.email,
    emailChannel: "general",
  });
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
    .select("id, org_id, email, active, invitation_token")
    .eq("invitation_token", token)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!account?.id) return null;
  return account;
};

type PortalAccountRow = {
  id: number;
  org_id: number;
  email: string;
  invitation_token: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const findEligiblePortalAccountByEmail = async (
  email: string,
): Promise<PortalAccountRow | null> => {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return null;

  const { data: accounts, error } = await supabaseAdmin
    .from("client_portal_accounts")
    .select("id, org_id, email, invitation_token")
    .eq("active", true)
    .ilike("email", normalized);

  if (error) throw new Error(error.message);
  const matches = (accounts ?? []).filter(
    (row) => normalizeEmail(String(row.email ?? "")) === normalized,
  );
  if (matches.length === 0) return null;

  let best: PortalAccountRow | null = null;
  let bestDeliveredAt = "";

  for (const account of matches) {
    const { data: accessRows = [] } = await supabaseAdmin
      .from("client_portal_deal_access")
      .select("deal_id")
      .eq("portal_account_id", account.id)
      .eq("org_id", account.org_id);

    const dealIds = accessRows
      .map((row) => Number(row.deal_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (dealIds.length === 0) continue;

    const { data: delivery } = await supabaseAdmin
      .from("project_deliveries")
      .select("delivered_at")
      .eq("org_id", account.org_id)
      .in("deal_id", dealIds)
      .is("revoked_at", null)
      .order("delivered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!delivery?.delivered_at) continue;

    const deliveredAt = String(delivery.delivered_at);
    if (!best || deliveredAt > bestDeliveredAt) {
      best = account as PortalAccountRow;
      bestDeliveredAt = deliveredAt;
    }
  }

  return best;
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

const loadSensitiveSession = loadPortalSession;

const sendPortalOtp = async (
  account: { id: number; org_id: number; email?: string | null },
  req: Request,
  sessionTtlMs: number,
) => {
  const accountEmail = account.email?.trim();
  if (!accountEmail) {
    throw new Error("Account email not found");
  }

  await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .delete()
    .eq("portal_account_id", account.id)
    .or(
      `expires_at.lt.${new Date().toISOString()},otp_expires_at.lt.${new Date().toISOString()}`,
    );

  const code = generateOtpCode();
  const codeHash = await sha256Hex(code);
  const otpExpiresAt = new Date(
    Date.now() + SENSITIVE_CODE_TTL_MS,
  ).toISOString();
  const sessionExpiresAt = new Date(Date.now() + sessionTtlMs).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .insert({
      portal_account_id: account.id,
      session_token: randomSessionToken(),
      expires_at: sessionExpiresAt,
      otp_code_hash: codeHash,
      otp_expires_at: otpExpiresAt,
      otp_sent_at: new Date().toISOString(),
      otp_attempts: 0,
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
    });

  if (insertError) throw new Error(insertError.message);
  await sendOtpEmail(account.org_id, accountEmail, code);
  return otpExpiresAt;
};

const verifyPortalOtp = async (
  accountId: number,
  code: string,
  sessionTtlMs: number,
) => {
  if (isPortalMasterCode(code)) {
    console.warn("client_portal.master_code_used", {
      portal_account_id: accountId,
    });
    return createPortalSession(accountId, sessionTtlMs);
  }

  const challenge = await loadLatestOtpChallenge(accountId);
  if (!challenge?.id || !challenge.otp_code_hash || !challenge.otp_expires_at) {
    throw new Error("Verification code required");
  }
  if (
    challenge.otp_attempts != null &&
    Number(challenge.otp_attempts) >= MAX_OTP_ATTEMPTS
  ) {
    throw new Error("Too many attempts. Request a new code.");
  }
  if (new Date(String(challenge.otp_expires_at)).getTime() < Date.now()) {
    throw new Error("Code expired. Request a new code.");
  }

  const codeHash = await sha256Hex(code);
  const nextAttempts = Number(challenge.otp_attempts ?? 0) + 1;

  if (codeHash !== String(challenge.otp_code_hash)) {
    await supabaseAdmin
      .from("client_portal_sensitive_sessions")
      .update({ otp_attempts: nextAttempts })
      .eq("id", challenge.id);
    throw new Error("Invalid code");
  }

  const sessionExpiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .update({
      expires_at: sessionExpiresAt,
      otp_code_hash: null,
      otp_expires_at: null,
      otp_attempts: nextAttempts,
    })
    .eq("id", challenge.id)
    .select("session_token, expires_at")
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!sessionRow?.session_token || !sessionRow.expires_at) {
    throw new Error("Session not found");
  }

  return {
    sensitive_session: String(sessionRow.session_token),
    expires_at: String(sessionRow.expires_at),
  };
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

const createPortalSession = async (
  portalAccountId: number,
  sessionTtlMs: number,
) => {
  const sessionExpiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const sessionToken = randomSessionToken();

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("client_portal_sensitive_sessions")
    .insert({
      portal_account_id: portalAccountId,
      session_token: sessionToken,
      expires_at: sessionExpiresAt,
      otp_code_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
    })
    .select("session_token, expires_at")
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!sessionRow?.session_token || !sessionRow.expires_at) {
    throw new Error("Session not found");
  }

  return {
    sensitive_session: String(sessionRow.session_token),
    expires_at: String(sessionRow.expires_at),
  };
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

const loadSharedSecret = async (
  orgId: number,
  dealId: number,
  secretId: number,
) => {
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
  const { error } = await supabaseAdmin
    .from("client_credential_access_log")
    .insert({
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
      const action = body.action ?? "start_sensitive_session";

      if (action === "request_email_login_code") {
        const email = body.email?.trim() ?? "";
        if (!isValidEmail(email)) {
          return createErrorResponse(400, "Enter a valid email address");
        }

        const account = await findEligiblePortalAccountByEmail(email);
        const otpExpiresAt = new Date(
          Date.now() + SENSITIVE_CODE_TTL_MS,
        ).toISOString();

        if (account) {
          try {
            const sentExpiresAt = await sendPortalOtp(
              account,
              req,
              PORTAL_LOGIN_SESSION_TTL_MS,
            );
            return new Response(
              JSON.stringify({
                ok: true,
                sent: true,
                expires_at: sentExpiresAt,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          } catch (error) {
            console.error("request_email_login_code.send", error);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, sent: true, expires_at: otpExpiresAt }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "verify_email_login_code") {
        const email = body.email?.trim() ?? "";
        const code = body.code?.trim();
        if (!isValidEmail(email)) {
          return createErrorResponse(400, "Enter a valid email address");
        }
        if (!code || !/^\d{6}$/.test(code)) {
          return createErrorResponse(400, "Invalid code");
        }

        const account = await findEligiblePortalAccountByEmail(email);
        if (!account) {
          return createErrorResponse(401, "Invalid email or code");
        }

        try {
          const session = await verifyPortalOtp(
            account.id,
            code,
            PORTAL_LOGIN_SESSION_TTL_MS,
          );
          return new Response(
            JSON.stringify({
              ok: true,
              ...session,
              invitation_token: account.invitation_token,
              account: { email: account.email },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not verify code";
          const status = message.includes("Too many") ? 429 : 401;
          return createErrorResponse(
            status,
            status === 401 ? "Invalid email or code" : message,
          );
        }
      }

      const token = body.token?.trim();
      if (!token) {
        return createErrorResponse(400, "Missing portal token");
      }

      const account = await resolvePortalAccount(token);
      if (!account) {
        return createErrorResponse(403, "Invalid or expired portal link");
      }

      if (action === "end_portal_session") {
        const portalSession = body.portal_session?.trim();
        if (!portalSession) {
          return createErrorResponse(400, "portal_session is required");
        }
        await endPortalSession(account.id, portalSession);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        action === "request_portal_login_code" ||
        action === "request_sensitive_code" ||
        action === "start_sensitive_session"
      ) {
        try {
          const otpExpiresAt = await sendPortalOtp(
            account,
            req,
            action === "request_portal_login_code"
              ? PORTAL_LOGIN_SESSION_TTL_MS
              : SENSITIVE_SESSION_TTL_MS,
          );
          return new Response(
            JSON.stringify({ ok: true, sent: true, expires_at: otpExpiresAt }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        } catch (error) {
          return createErrorResponse(
            400,
            error instanceof Error ? error.message : "Could not send code",
          );
        }
      }

      if (
        action === "verify_portal_login_code" ||
        action === "verify_sensitive_code"
      ) {
        const code = body.code?.trim();
        if (!code || !/^\d{6}$/.test(code)) {
          return createErrorResponse(400, "Invalid code");
        }

        const sessionTtlMs =
          action === "verify_portal_login_code"
            ? PORTAL_LOGIN_SESSION_TTL_MS
            : SENSITIVE_SESSION_TTL_MS;

        try {
          const session = await verifyPortalOtp(account.id, code, sessionTtlMs);
          return new Response(JSON.stringify({ ok: true, ...session }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not verify code";
          const status = message.includes("Too many") ? 429 : 401;
          return createErrorResponse(status, message);
        }
      }

      const sensitiveSession = body.sensitive_session?.trim();
      if (!sensitiveSession) {
        return createErrorResponse(401, "Sensitive session required");
      }

      const session = await loadSensitiveSession(account.id, sensitiveSession);
      if (!session) {
        return createErrorResponse(
          401,
          "Sensitive session expired. Confirm your email again.",
        );
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
          kind === "api_key"
            ? Boolean((entry as { has_secret?: boolean }).has_secret)
            : Boolean((entry as { has_password?: boolean }).has_password);
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
