import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { memberHasCapability } from "../_shared/mailAccount.ts";

type Member = {
  id: number;
  org_id: number;
  administrator: boolean | null;
  user_id: string;
  module_permissions?: Record<string, unknown> | null;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const redirect = (url: string) =>
  new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });

const randomState = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const appOrigin = () =>
  Deno.env.get("MAIL_OAUTH_APP_ORIGIN") ||
  Deno.env.get("PUBLIC_APP_URL") ||
  "http://localhost:5174";

const mailOauthRedirectUri = () =>
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/mail_oauth`;

async function authenticate(
  req: Request,
): Promise<{ member: Member } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: "Unauthorized", status: 401 };
  const member = (await getUserOrganizationMember(data.user)) as Member | null;
  if (!member) return { error: "Forbidden", status: 403 };
  return { member };
}

function settingsReturnUrl(extra: Record<string, string>) {
  const u = new URL("/settings", appOrigin());
  u.searchParams.set("tab", "connectors");
  u.searchParams.set("section", "mailboxes");
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.has("code")) {
    const code = url.searchParams.get("code")!;
    const state = url.searchParams.get("state") || "";
    try {
      const { data: row } = await supabaseAdmin
        .from("mail_oauth_states")
        .select("*")
        .eq("state", state)
        .maybeSingle();
      if (!row) {
        return redirect(
          settingsReturnUrl({ mail_error: "Invalid OAuth state" }),
        );
      }
      await supabaseAdmin.from("mail_oauth_states").delete().eq("state", state);

      const provider = row.provider as "google" | "microsoft";
      let email = "";
      let refreshToken = "";
      let accessToken = "";
      let expiresAt: string | null = null;
      let scopes: string[] = [];

      if (provider === "google") {
        const clientId = Deno.env.get("MAIL_GOOGLE_CLIENT_ID") ||
          Deno.env.get("GOOGLE_GSC_CLIENT_ID");
        const clientSecret = Deno.env.get("MAIL_GOOGLE_CLIENT_SECRET") ||
          Deno.env.get("GOOGLE_GSC_CLIENT_SECRET");
        if (!clientId || !clientSecret) {
          return redirect(
            settingsReturnUrl({
              mail_error: "Google Mail OAuth not configured",
            }),
          );
        }
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: mailOauthRedirectUri(),
            grant_type: "authorization_code",
          }),
        });
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok) {
          return redirect(
            settingsReturnUrl({
              mail_error: tokenJson.error_description || "Token exchange failed",
            }),
          );
        }
        accessToken = tokenJson.access_token;
        refreshToken = tokenJson.refresh_token || "";
        expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;
        scopes = String(tokenJson.scope || "").split(" ").filter(Boolean);
        const profileRes = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const profile = await profileRes.json();
        email = String(profile.email || "").toLowerCase();
      } else {
        const clientId = Deno.env.get("MAIL_MICROSOFT_CLIENT_ID");
        const clientSecret = Deno.env.get("MAIL_MICROSOFT_CLIENT_SECRET");
        if (!clientId || !clientSecret) {
          return redirect(
            settingsReturnUrl({
              mail_error: "Microsoft Mail OAuth not configured",
            }),
          );
        }
        const tokenRes = await fetch(
          "https://login.microsoftonline.com/common/oauth2/v2.0/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: mailOauthRedirectUri(),
              grant_type: "authorization_code",
            }),
          },
        );
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok) {
          return redirect(
            settingsReturnUrl({
              mail_error: tokenJson.error_description || "Token exchange failed",
            }),
          );
        }
        accessToken = tokenJson.access_token;
        refreshToken = tokenJson.refresh_token || "";
        expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;
        scopes = String(tokenJson.scope || "").split(" ").filter(Boolean);
        const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        email = String(
          profile.mail || profile.userPrincipalName || "",
        ).toLowerCase();
      }

      if (!email) {
        return redirect(
          settingsReturnUrl({ mail_error: "No email on account" }),
        );
      }

      const ownerMemberId = row.scope === "personal" ? row.member_id : null;
      const tokenPayload = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      };

      const { data: existing } = await supabaseAdmin
        .from("mail_accounts")
        .select("id")
        .eq("org_id", row.org_id)
        .ilike("email", email)
        .is("owner_member_id", ownerMemberId)
        .maybeSingle();

      let accountId = existing?.id as number | undefined;
      if (accountId) {
        await supabaseAdmin
          .from("mail_accounts")
          .update({
            provider,
            status: "connected",
            scopes,
            token_payload: tokenPayload,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", accountId);
      } else {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("mail_accounts")
          .insert({
            org_id: row.org_id,
            owner_member_id: ownerMemberId,
            provider,
            email,
            status: "connected",
            scopes,
            token_payload: tokenPayload,
            created_by_member_id: row.member_id,
          })
          .select("id")
          .single();
        if (insertErr) {
          return redirect(
            settingsReturnUrl({ mail_error: insertErr.message }),
          );
        }
        accountId = inserted.id;
      }

      // Sync is started from Settings after the user picks a date range.
      return redirect(
        settingsReturnUrl({
          mail_connected: "1",
          mail_account_id: String(accountId),
        }),
      );
    } catch (e) {
      return redirect(
        settingsReturnUrl({
          mail_error: e instanceof Error ? e.message : "OAuth failed",
        }),
      );
    }
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const auth = await authenticate(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { member } = auth;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "start") {
    const provider = body.provider as "google" | "microsoft";
    const scope = body.scope as "org" | "personal";
    if (provider !== "google" && provider !== "microsoft") {
      return json({ error: "Invalid provider" }, 400);
    }
    if (scope !== "org" && scope !== "personal") {
      return json({ error: "Invalid scope" }, 400);
    }
    const manageCap =
      scope === "org" ? "mail.org.manage" : "mail.personal.manage";
    if (
      !memberHasCapability(member, manageCap) &&
      !member.administrator
    ) {
      return json({ error: "Forbidden" }, 403);
    }

    const state = randomState();
    await supabaseAdmin.from("mail_oauth_states").insert({
      state,
      org_id: member.org_id,
      member_id: member.id,
      provider,
      scope,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    if (provider === "google") {
      const clientId = Deno.env.get("MAIL_GOOGLE_CLIENT_ID") ||
        Deno.env.get("GOOGLE_GSC_CLIENT_ID");
      if (!clientId) {
        return json({ error: "Google Mail OAuth not configured" }, 503);
      }
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", mailOauthRedirectUri());
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set(
        "scope",
        [
          "openid",
          "email",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.send",
        ].join(" "),
      );
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      return json({ url: authUrl.toString() });
    }

    const clientId = Deno.env.get("MAIL_MICROSOFT_CLIENT_ID");
    if (!clientId) {
      return json({ error: "Microsoft Mail OAuth not configured" }, 503);
    }
    const authUrl = new URL(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", mailOauthRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      [
        "openid",
        "email",
        "offline_access",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
      ].join(" "),
    );
    authUrl.searchParams.set("state", state);
    return json({ url: authUrl.toString() });
  }

  if (action === "disconnect") {
    const accountId = Number(body.account_id);
    if (!accountId) return json({ error: "account_id required" }, 400);
    const { data: account } = await supabaseAdmin
      .from("mail_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("org_id", member.org_id)
      .maybeSingle();
    if (!account) return json({ error: "Not found" }, 404);
    const isPersonal = account.owner_member_id != null;
    if (isPersonal) {
      if (
        account.owner_member_id !== member.id &&
        !member.administrator &&
        !memberHasCapability(member, "mail.org.manage")
      ) {
        return json({ error: "Forbidden" }, 403);
      }
    } else if (
      !memberHasCapability(member, "mail.org.manage") &&
      !member.administrator
    ) {
      return json({ error: "Forbidden" }, 403);
    }
    await supabaseAdmin.from("mail_accounts").delete().eq("id", accountId);
    return json({ ok: true });
  }

  if (action === "status") {
    const { data } = await supabaseAdmin
      .from("mail_accounts")
      .select(
        "id, email, provider, status, last_sync_at, error_message, owner_member_id",
      )
      .eq("org_id", member.org_id);
    return json({ accounts: data ?? [] });
  }

  return json({ error: "Unknown action" }, 400);
});
