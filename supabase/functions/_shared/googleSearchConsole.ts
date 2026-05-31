import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const GOOGLE_GSC_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export type GscSearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSnapshotPayload = {
  site_url: string;
  period_start: string;
  period_end: string;
  totals: GscTotals;
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  top_pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
};

export const getGoogleGscClientId = () =>
  Deno.env.get("GOOGLE_GSC_CLIENT_ID")?.trim() ?? "";

export const getGoogleGscClientSecret = () =>
  Deno.env.get("GOOGLE_GSC_CLIENT_SECRET")?.trim() ?? "";

export const buildGoogleGscCallbackUrl = () => {
  const explicit = Deno.env.get("GOOGLE_GSC_REDIRECT_URI")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/functions/v1/google_gsc/oauth-callback`;
};

export const getDefaultGscRedirectAfter = () => {
  const fromEnv = Deno.env.get("GOOGLE_GSC_DEFAULT_REDIRECT_AFTER")?.trim();
  if (fromEnv) return fromEnv;
  const appBase = Deno.env.get("APP_BASE_URL")?.trim()?.replace(/\/$/, "");
  if (appBase) return `${appBase}/settings?tab=web-monitor`;
  return "https://www.nomicrm.com/settings?tab=web-monitor";
};

export const extractDomainFromMonitorUrl = (url: string): string | null => {
  const value = url.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
};

export const resolveGscSiteUrl = (
  monitorUrl: string,
  gscSites: string[],
  existing?: string | null,
): string | null => {
  if (existing && gscSites.includes(existing)) return existing;

  const domain = extractDomainFromMonitorUrl(monitorUrl);
  if (!domain) return null;

  const candidates = [
    `sc-domain:${domain}`,
    `https://${domain}/`,
    `https://www.${domain}/`,
  ];
  for (const candidate of candidates) {
    if (gscSites.includes(candidate)) return candidate;
  }

  const normalizedDomain = domain.replace(/\./g, "\\.");
  const pattern = new RegExp(`^https?://(www\\.)?${normalizedDomain}/?$`, "i");
  const urlMatch = gscSites.find((entry) => pattern.test(entry));
  if (urlMatch) return urlMatch;

  const domainProperty = gscSites.find(
    (entry) => entry.toLowerCase() === `sc-domain:${domain}`,
  );
  return domainProperty ?? null;
};

export const gscAnalyticsDateRange = () => {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
};

const exchangeToken = async (body: URLSearchParams) => {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(
      `Google token error (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
};

export const exchangeGoogleGscCode = async (code: string) => {
  const redirectUri = buildGoogleGscCallbackUrl();
  if (!redirectUri) throw new Error("GOOGLE_GSC redirect URI is not configured");

  return exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getGoogleGscClientId(),
      client_secret: getGoogleGscClientSecret(),
      redirect_uri: redirectUri,
    }),
  );
};

export const refreshGoogleGscAccessToken = async (refreshToken: string) =>
  exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getGoogleGscClientId(),
      client_secret: getGoogleGscClientSecret(),
    }),
  );

export const buildGoogleGscAuthorizeUrl = (state: string) => {
  const redirectUri = buildGoogleGscCallbackUrl();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getGoogleGscClientId(),
    redirect_uri: redirectUri,
    scope: GOOGLE_GSC_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

export const fetchGoogleUserEmail = async (accessToken: string) => {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email?.trim() ?? null;
};

export const getFreshGoogleGscAccessToken = async (
  supabase: SupabaseClient,
  orgId: number,
): Promise<{ accessToken: string; googleEmail: string | null }> => {
  const { data: cred, error } = await supabase
    .from("google_gsc_credentials")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !cred?.refresh_token) {
    throw new Error("Search Console no conectado para esta organización.");
  }

  const safetyMs = 60_000;
  const expiresAt = cred.access_token_expires_at
    ? new Date(cred.access_token_expires_at).getTime()
    : 0;

  if (cred.access_token && expiresAt > Date.now() + safetyMs) {
    return {
      accessToken: cred.access_token as string,
      googleEmail: cred.google_email as string | null,
    };
  }

  const refreshed = await refreshGoogleGscAccessToken(cred.refresh_token);
  const expires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("google_gsc_credentials")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: expires,
      scopes: refreshed.scope?.split(" ") ?? cred.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  return {
    accessToken: refreshed.access_token,
    googleEmail: cred.google_email as string | null,
  };
};

export const listGscSites = async (accessToken: string): Promise<string[]> => {
  const res = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `GSC sites list failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  const entries = (data as { siteEntry?: Array<{ siteUrl?: string }> })
    .siteEntry ?? [];
  return entries
    .map((entry) => entry.siteUrl?.trim())
    .filter(Boolean) as string[];
};

const querySearchAnalytics = async (
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<GscSearchAnalyticsRow[]> => {
  const encodedSite = encodeURIComponent(siteUrl);
  const res = await fetch(
    `${GSC_API_BASE}/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `GSC searchAnalytics failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return ((data as { rows?: GscSearchAnalyticsRow[] }).rows ?? []);
};

const rowToTotals = (rows: GscSearchAnalyticsRow[]): GscTotals => {
  const row = rows[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
};

export const fetchGscSnapshot = async (
  accessToken: string,
  siteUrl: string,
): Promise<GscSnapshotPayload> => {
  const { startDate, endDate } = gscAnalyticsDateRange();

  const [totalRows, queryRows, pageRows] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, { startDate, endDate }),
    querySearchAnalytics(accessToken, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 25,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 25,
    }),
  ]);

  return {
    site_url: siteUrl,
    period_start: startDate,
    period_end: endDate,
    totals: rowToTotals(totalRows),
    top_queries: queryRows.map((row) => ({
      query: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
    top_pages: pageRows.map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    })),
  };
};

export const syncMonitoredWebsiteGsc = async (
  supabase: SupabaseClient,
  orgId: number,
  monitoredWebsiteId: number,
  accessToken: string,
  gscSites: string[],
): Promise<{ ok: boolean; reason?: string; snapshot_id?: number }> => {
  const { data: site, error } = await supabase
    .from("monitored_websites")
    .select("id, org_id, url, gsc_site_url")
    .eq("id", monitoredWebsiteId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!site) return { ok: false, reason: "site_not_found" };

  const gscSiteUrl = resolveGscSiteUrl(
    site.url,
    gscSites,
    site.gsc_site_url,
  );
  if (!gscSiteUrl) {
    return { ok: false, reason: "no_matching_gsc_property" };
  }

  if (gscSiteUrl !== site.gsc_site_url) {
    await supabase
      .from("monitored_websites")
      .update({ gsc_site_url: gscSiteUrl, updated_at: new Date().toISOString() })
      .eq("id", site.id);
  }

  const snapshot = await fetchGscSnapshot(accessToken, gscSiteUrl);

  const { data: inserted, error: insertError } = await supabase
    .from("gsc_search_analytics_snapshots")
    .insert({
      org_id: orgId,
      monitored_website_id: site.id,
      site_url: snapshot.site_url,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      totals: snapshot.totals,
      top_queries: snapshot.top_queries,
      top_pages: snapshot.top_pages,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  await supabase
    .from("google_gsc_credentials")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return { ok: true, snapshot_id: inserted?.id };
};

export const triggerGoogleGscSync = (params: {
  orgId: number;
  monitoredWebsiteId: number;
}) => {
  const secret = Deno.env.get("WEB_AUDIT_WORKER_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
  if (!secret || !supabaseUrl) return;

  fetch(`${supabaseUrl}/functions/v1/google_gsc/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      org_id: params.orgId,
      monitored_website_id: params.monitoredWebsiteId,
    }),
  }).catch((err) => console.error("triggerGoogleGscSync", err));
};
