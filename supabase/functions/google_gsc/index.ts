import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { verifyWebsiteAuditWorkerSecret } from "../_shared/websiteAuditAuth.ts";
import {
  buildGoogleGscAuthorizeUrl,
  exchangeGoogleGscCode,
  fetchGoogleUserEmail,
  getDefaultGscRedirectAfter,
  getFreshGoogleGscAccessToken,
  getGoogleGscClientId,
  getGoogleGscClientSecret,
  GOOGLE_GSC_SCOPE,
  listGscSites,
  syncMonitoredWebsiteGsc,
} from "../_shared/googleSearchConsole.ts";

type Member = {
  id: number;
  org_id: number;
  administrator: boolean | null;
  user_id: string;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const randomState = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const appendQuery = (url: string, extra: Record<string, string>) => {
  try {
    const u = new URL(url);
    for (const [key, value] of Object.entries(extra)) {
      u.searchParams.set(key, value);
    }
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    const tail = Object.entries(extra)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    return `${url}${sep}${tail}`;
  }
};

const authenticateAdmin = async (
  req: Request,
): Promise<{ member: Member } | { error: string; status: number }> => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Unauthorized", status: 401 };
  }
  const member = (await getUserOrganizationMember(data.user)) as Member | null;
  if (!member) return { error: "Forbidden", status: 403 };
  if (!member.administrator) {
    return { error: "Only administrators can manage Search Console", status: 403 };
  }
  return { member };
};

const isInternalSyncRequest = (req: Request) => {
  const secret = Deno.env.get("WEB_AUDIT_WORKER_SECRET")?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  return token === secret;
};

const handleStatus = async (member: Member) => {
  const { data: cred } = await supabaseAdmin
    .from("google_gsc_credentials")
    .select(
      "google_email, connected_by, last_synced_at, created_at, updated_at",
    )
    .eq("org_id", member.org_id)
    .maybeSingle();

  const { count: snapshotCount } = await supabaseAdmin
    .from("gsc_search_analytics_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("org_id", member.org_id);

  return json({
    ok: true,
    connected: Boolean(cred?.google_email),
    google_email: cred?.google_email ?? null,
    last_synced_at: cred?.last_synced_at ?? null,
    snapshot_count: snapshotCount ?? 0,
    scope: GOOGLE_GSC_SCOPE,
  });
};

const handleStartOAuth = async (req: Request, member: Member) => {
  if (!getGoogleGscClientId() || !getGoogleGscClientSecret()) {
    return createErrorResponse(
      503,
      "GOOGLE_GSC_CLIENT_ID or GOOGLE_GSC_CLIENT_SECRET not configured",
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    redirect_after?: string;
  };

  const state = randomState();
  const { error: insertError } = await supabaseAdmin
    .from("google_gsc_oauth_states")
    .insert({
      org_id: member.org_id,
      state,
      redirect_after: body.redirect_after ?? null,
      initiated_by: member.user_id,
    });

  if (insertError) return createErrorResponse(500, insertError.message);

  return json({
    ok: true,
    authorize_url: buildGoogleGscAuthorizeUrl(state),
    state,
  });
};

const handleOAuthCallback = async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const fallbackRedirect = getDefaultGscRedirectAfter();

  if (!state) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(fallbackRedirect, { gsc_error: "missing_state" }),
        ...corsHeaders,
      },
    });
  }

  const { data: stateRow } = await supabaseAdmin
    .from("google_gsc_oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  const redirectAfter = stateRow?.redirect_after ?? fallbackRedirect;

  if (!stateRow || stateRow.used_at) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(redirectAfter, { gsc_error: "invalid_state" }),
        ...corsHeaders,
      },
    });
  }

  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(redirectAfter, { gsc_error: "state_expired" }),
        ...corsHeaders,
      },
    });
  }

  if (errorParam || !code) {
    await supabaseAdmin
      .from("google_gsc_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRow.id);
    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(redirectAfter, {
          gsc_error: errorParam ?? "missing_code",
        }),
        ...corsHeaders,
      },
    });
  }

  try {
    const tokens = await exchangeGoogleGscCode(code);
    const email = await fetchGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    const upsertPayload: Record<string, unknown> = {
      org_id: stateRow.org_id,
      google_email: email,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      scopes: tokens.scope?.split(" ") ?? [GOOGLE_GSC_SCOPE],
      connected_by: stateRow.initiated_by,
      updated_at: new Date().toISOString(),
    };
    if (tokens.refresh_token) {
      upsertPayload.refresh_token = tokens.refresh_token;
    } else {
      const { data: existing } = await supabaseAdmin
        .from("google_gsc_credentials")
        .select("refresh_token")
        .eq("org_id", stateRow.org_id)
        .maybeSingle();
      if (!existing?.refresh_token) {
        throw new Error("Google no devolvió refresh_token; revoca acceso y reconecta.");
      }
      upsertPayload.refresh_token = existing.refresh_token;
    }

    await supabaseAdmin.from("google_gsc_credentials").upsert(upsertPayload);

    await supabaseAdmin
      .from("google_gsc_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(redirectAfter, { gsc_connected: "1" }),
        ...corsHeaders,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return new Response(null, {
      status: 302,
      headers: {
        Location: appendQuery(redirectAfter, {
          gsc_error: message.slice(0, 180),
        }),
        ...corsHeaders,
      },
    });
  }
};

const handleDisconnect = async (member: Member) => {
  await supabaseAdmin
    .from("google_gsc_credentials")
    .delete()
    .eq("org_id", member.org_id);
  return json({ ok: true, disconnected: true });
};

const handleListSites = async (member: Member) => {
  const { accessToken } = await getFreshGoogleGscAccessToken(
    supabaseAdmin,
    member.org_id,
  );
  const sites = await listGscSites(accessToken);
  return json({ ok: true, sites });
};

const handleSync = async (
  req: Request,
  member: Member | null,
  orgId: number,
) => {
  const body = (await req.json().catch(() => ({}))) as {
    monitored_website_id?: number;
    sync_all?: boolean;
  };

  const { accessToken } = await getFreshGoogleGscAccessToken(
    supabaseAdmin,
    orgId,
  );
  const gscSites = await listGscSites(accessToken);

  if (body.monitored_website_id) {
    const result = await syncMonitoredWebsiteGsc(
      supabaseAdmin,
      orgId,
      Number(body.monitored_website_id),
      accessToken,
      gscSites,
    );
    return json({ ok: true, ...result });
  }

  if (body.sync_all) {
    const { data: sites, error } = await supabaseAdmin
      .from("monitored_websites")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_enabled", true)
      .limit(50);

    if (error) return createErrorResponse(500, error.message);

    let synced = 0;
    let skipped = 0;
    for (const site of sites ?? []) {
      const result = await syncMonitoredWebsiteGsc(
        supabaseAdmin,
        orgId,
        site.id,
        accessToken,
        gscSites,
      );
      if (result.ok) synced += 1;
      else skipped += 1;
    }
    return json({ ok: true, synced, skipped });
  }

  if (!member) {
    return createErrorResponse(400, "monitored_website_id or sync_all required");
  }

  return createErrorResponse(
    400,
    "Provide monitored_website_id or sync_all=true",
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const route = (segments[1] ?? "").toLowerCase();

  if (req.method === "GET" && route === "oauth-callback") {
    try {
      return await handleOAuthCallback(req);
    } catch (cause) {
      return createErrorResponse(
        500,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  if (req.method === "POST" && route === "sync" && isInternalSyncRequest(req)) {
    try {
      const body = (await req.json().catch(() => ({}))) as {
        org_id?: number;
        monitored_website_id?: number;
      };
      const orgId = Number(body.org_id);
      const siteId = Number(body.monitored_website_id);
      if (!Number.isFinite(orgId) || !Number.isFinite(siteId)) {
        return createErrorResponse(400, "org_id and monitored_website_id required");
      }
      const { accessToken } = await getFreshGoogleGscAccessToken(
        supabaseAdmin,
        orgId,
      );
      const gscSites = await listGscSites(accessToken);
      const result = await syncMonitoredWebsiteGsc(
        supabaseAdmin,
        orgId,
        siteId,
        accessToken,
        gscSites,
      );
      return json({ ok: true, ...result });
    } catch (cause) {
      return createErrorResponse(
        500,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  const auth = await authenticateAdmin(req);
  if ("error" in auth) {
    return createErrorResponse(auth.status, auth.error);
  }
  const { member } = auth;

  try {
    if (req.method === "GET" && (route === "" || route === "status")) {
      return await handleStatus(member);
    }
    if (req.method === "POST" && route === "start-oauth") {
      return await handleStartOAuth(req, member);
    }
    if (req.method === "POST" && route === "disconnect") {
      return await handleDisconnect(member);
    }
    if (req.method === "GET" && route === "sites") {
      return await handleListSites(member);
    }
    if (req.method === "POST" && route === "sync") {
      return await handleSync(req, member, member.org_id);
    }
    return createErrorResponse(404, `Unknown route: ${req.method} /${route}`);
  } catch (cause) {
    console.error("[google_gsc]", cause);
    return createErrorResponse(
      500,
      cause instanceof Error ? cause.message : String(cause),
    );
  }
});
