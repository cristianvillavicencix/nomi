// =====================================================================
// zoho_oneshot_import — Fase 2: one-shot import from Zoho CRM
// =====================================================================
// Routes:
//   GET  /health                 → public health check, no auth, reports env
//   GET  /                       → org status (auth required, admin only)
//   POST /setup-credentials      → exchange Zoho grant_token → refresh+access
//   POST /test-connection        → fetch 5 Zoho Contacts (sanity)
//   POST /sync-all               → page Zoho into *_raw staging tables
//   POST /promote { dry_run? }   → promote staging → canonical (dedup)
//
// Auth: every non-`/health` route requires Bearer JWT from an
// `organization_members` row with `administrator = true`. The function
// is scoped to that member's `org_id`.
//
// verify_jwt is FALSE at the gateway because /health needs to be public.
// Custom JWT verification happens in `authenticate()` inside this file.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";

const VERSION = "1.0.0";

const ZOHO_CLIENT_ID = Deno.env.get("ZOHO_CLIENT_ID") ?? "";
const ZOHO_CLIENT_SECRET = Deno.env.get("ZOHO_CLIENT_SECRET") ?? "";

type ZohoRegion = "com" | "eu" | "in" | "au" | "jp" | "cn" | "ca";

const ZOHO_REGION_DOMAINS: Record<
  ZohoRegion,
  { accounts: string; api: string }
> = {
  com: { accounts: "https://accounts.zoho.com", api: "https://www.zohoapis.com" },
  eu:  { accounts: "https://accounts.zoho.eu",  api: "https://www.zohoapis.eu"  },
  in:  { accounts: "https://accounts.zoho.in",  api: "https://www.zohoapis.in"  },
  au:  { accounts: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au" },
  jp:  { accounts: "https://accounts.zoho.jp",  api: "https://www.zohoapis.jp"  },
  cn:  { accounts: "https://accounts.zoho.com.cn", api: "https://www.zohoapis.com.cn" },
  ca:  { accounts: "https://accounts.zohocloud.ca", api: "https://www.zohoapis.ca" },
};

type Member = {
  id: number;
  org_id: number;
  administrator: boolean | null;
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type AuthOk = { member: Member };
type AuthErr = { error: string; status: number };

// ---------------------------- helpers ----------------------------

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status,
  });
}

function getRegionDomains(region: string) {
  const key = (region || "com").toLowerCase();
  if (!(key in ZOHO_REGION_DOMAINS)) {
    throw new Error(`Unsupported Zoho region: ${region}`);
  }
  return ZOHO_REGION_DOMAINS[key as ZohoRegion];
}

async function authenticate(req: Request): Promise<AuthOk | AuthErr> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing Authorization header", status: 401 };
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Invalid auth token", status: 401 };
  }
  const raw = await getUserOrganizationMember(data.user);
  const member = raw as Member | null | undefined;
  if (!member) {
    return { error: "User has no organization_members row", status: 403 };
  }
  if (!member.administrator) {
    return {
      error: "Only org administrators can run the Zoho importer",
      status: 403,
    };
  }
  return { member };
}

// ---------------------------- Zoho OAuth ----------------------------

async function exchangeGrantToken(
  grantToken: string,
  region: string,
  redirectUri: string,
) {
  const { accounts } = getRegionDomains(region);
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    client_id:     ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    code:          grantToken,
    redirect_uri:  redirectUri,
  });
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.refresh_token) {
    throw new Error(
      `Zoho token exchange failed (status ${res.status}): ${JSON.stringify(data)}`,
    );
  }
  return data as {
    access_token: string;
    refresh_token: string;
    api_domain: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };
}

async function refreshAccessToken(refreshToken: string, region: string) {
  const { accounts } = getRegionDomains(region);
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    client_id:     ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(
      `Zoho refresh failed (status ${res.status}): ${JSON.stringify(data)}`,
    );
  }
  return data as {
    access_token: string;
    api_domain?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };
}

async function getFreshAccessToken(orgId: number) {
  const { data: cred, error } = await supabaseAdmin
    .from("zoho_oauth_credentials")
    .select("*")
    .eq("org_id", orgId)
    .single();
  if (error || !cred) {
    throw new Error(
      "No Zoho credentials configured. POST /setup-credentials first.",
    );
  }

  const safetyMs = 60_000;
  const expiresAt = cred.access_token_expires_at
    ? new Date(cred.access_token_expires_at).getTime()
    : 0;
  if (cred.access_token && expiresAt > Date.now() + safetyMs) {
    return {
      accessToken: cred.access_token as string,
      apiDomain:   cred.api_domain as string,
      region:      cred.region as string,
    };
  }

  const refreshed = await refreshAccessToken(cred.refresh_token, cred.region);
  const apiDomain =
    refreshed.api_domain ?? cred.api_domain ?? getRegionDomains(cred.region).api;
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();

  await supabaseAdmin
    .from("zoho_oauth_credentials")
    .update({
      access_token:            refreshed.access_token,
      access_token_expires_at: newExpiresAt,
      api_domain:              apiDomain,
      last_refreshed_at:       new Date().toISOString(),
      scope:                   refreshed.scope ?? cred.scope,
    })
    .eq("org_id", orgId);

  return {
    accessToken: refreshed.access_token,
    apiDomain,
    region:      cred.region as string,
  };
}

async function zohoFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });
  if (res.status === 204) return { data: [], info: { more_records: false } };
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Zoho API ${res.status} ${url}: ${text.slice(0, 500)}`,
    );
  }
  return body as { data?: unknown[]; info?: { more_records?: boolean } };
}

// ---------------------------- route handlers ----------------------------

function handleHealth() {
  return json({
    ok: true,
    function: "zoho_oneshot_import",
    version: VERSION,
    env: {
      has_client_id:        ZOHO_CLIENT_ID.length > 0,
      has_client_secret:    ZOHO_CLIENT_SECRET.length > 0,
      has_supabase_url:     !!Deno.env.get("SUPABASE_URL"),
      has_service_role_key:
        !!Deno.env.get("SB_SECRET_KEY") ||
        !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
        !!Deno.env.get("SECRET_KEY"),
    },
  });
}

async function handleStatus(member: Member) {
  const orgId = member.org_id;

  const { data: cred } = await supabaseAdmin
    .from("zoho_oauth_credentials")
    .select(
      "region, scope, api_domain, access_token_expires_at, last_refreshed_at, created_at, updated_at",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  const counts = await Promise.all([
    supabaseAdmin
      .from("zoho_contacts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabaseAdmin
      .from("zoho_accounts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabaseAdmin
      .from("zoho_deals_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabaseAdmin
      .from("zoho_contacts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("promoted_at", "is", null),
    supabaseAdmin
      .from("zoho_accounts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("promoted_at", "is", null),
    supabaseAdmin
      .from("zoho_deals_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("promoted_at", "is", null),
  ]);

  return json({
    ok: true,
    function: "zoho_oneshot_import",
    version: VERSION,
    org_id: orgId,
    credentials: cred
      ? {
          configured:              true,
          region:                  cred.region,
          api_domain:              cred.api_domain,
          scope:                   cred.scope,
          access_token_expires_at: cred.access_token_expires_at,
          last_refreshed_at:       cred.last_refreshed_at,
          created_at:              cred.created_at,
        }
      : { configured: false },
    staging: {
      contacts_raw: {
        total:    counts[0].count ?? 0,
        promoted: counts[3].count ?? 0,
      },
      accounts_raw: {
        total:    counts[1].count ?? 0,
        promoted: counts[4].count ?? 0,
      },
      deals_raw: {
        total:    counts[2].count ?? 0,
        promoted: counts[5].count ?? 0,
      },
    },
  });
}

async function handleSetupCredentials(req: Request, member: Member) {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    return createErrorResponse(
      500,
      "Server missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET environment variables",
    );
  }
  const body = (await req.json().catch(() => null)) as
    | {
        grant_token?: string;
        region?: string;
        redirect_uri?: string;
      }
    | null;
  if (!body?.grant_token || typeof body.grant_token !== "string") {
    return createErrorResponse(400, "Missing required field: grant_token");
  }
  const region = (body.region ?? "com").toLowerCase();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const redirectUri =
    body.redirect_uri ??
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/zoho_oneshot_import/setup-credentials`;

  try {
    const exchanged = await exchangeGrantToken(
      body.grant_token,
      region,
      redirectUri,
    );
    const expiresAt = new Date(
      Date.now() + exchanged.expires_in * 1000,
    ).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("zoho_oauth_credentials")
      .upsert(
        {
          org_id:                  member.org_id,
          region,
          access_token:            exchanged.access_token,
          refresh_token:           exchanged.refresh_token,
          access_token_expires_at: expiresAt,
          api_domain:              exchanged.api_domain,
          scope:                   exchanged.scope ?? null,
          last_refreshed_at:       new Date().toISOString(),
        },
        { onConflict: "org_id" },
      );

    if (upsertError) throw upsertError;

    return json({
      ok: true,
      region,
      api_domain:              exchanged.api_domain,
      scope:                   exchanged.scope ?? null,
      access_token_expires_at: expiresAt,
      refresh_token_stored:    true,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return createErrorResponse(400, message);
  }
}

async function handleTestConnection(member: Member) {
  try {
    const { accessToken, apiDomain } = await getFreshAccessToken(member.org_id);
    const data = await zohoFetch(
      `${apiDomain}/crm/v2/Contacts?per_page=5&fields=id,Full_Name,Email,Account_Name`,
      accessToken,
    );
    const records = (data?.data ?? []) as Array<Record<string, unknown>>;
    return json({
      ok: true,
      api_domain: apiDomain,
      total_in_response: records.length,
      sample: records.map((c) => ({
        id:        c.id,
        full_name: c.Full_Name,
        email:     c.Email,
        account:
          c.Account_Name && typeof c.Account_Name === "object"
            ? (c.Account_Name as { name?: string }).name ?? null
            : null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return createErrorResponse(400, message);
  }
}

async function pageThroughModule(
  module: "Contacts" | "Accounts" | "Deals",
  rawTable: "zoho_contacts_raw" | "zoho_accounts_raw" | "zoho_deals_raw",
  orgId: number,
  accessToken: string,
  apiDomain: string,
  perPage: number,
  maxPages: number,
) {
  let page = 1;
  let totalFetched = 0;
  let totalUpserted = 0;
  const errors: string[] = [];
  let moreRecords = true;

  while (moreRecords && page <= maxPages) {
    const url = `${apiDomain}/crm/v2/${module}?page=${page}&per_page=${perPage}`;
    let resp: { data?: unknown[]; info?: { more_records?: boolean } };
    try {
      resp = await zohoFetch(url, accessToken);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`page ${page}: ${message}`);
      break;
    }

    const records = (resp?.data ?? []) as Array<Record<string, unknown>>;
    totalFetched += records.length;

    if (records.length > 0) {
      const rows = records.map((r) => ({
        org_id:          orgId,
        zoho_id:         String(r.id),
        payload:         r,
        promoted_at:     null,
        promotion_error: null,
      }));
      const { error: upsertError } = await supabaseAdmin
        .from(rawTable)
        .upsert(rows, { onConflict: "org_id,zoho_id" });
      if (upsertError) {
        errors.push(`page ${page} upsert: ${upsertError.message}`);
      } else {
        totalUpserted += rows.length;
      }
    }

    moreRecords = !!resp?.info?.more_records;
    page += 1;
  }

  return { totalFetched, totalUpserted, lastPage: page - 1, errors };
}

async function handleSyncAll(req: Request, member: Member) {
  const body = (await req.json().catch(() => ({}))) as {
    modules?: unknown;
    max_pages?: unknown;
    per_page?: unknown;
  };
  const requestedModules: string[] = Array.isArray(body.modules)
    ? (body.modules as unknown[]).filter(
        (m): m is string => typeof m === "string",
      )
    : ["Contacts", "Accounts", "Deals"];
  const modules = requestedModules.filter((m) =>
    ["Contacts", "Accounts", "Deals"].includes(m),
  ) as Array<"Contacts" | "Accounts" | "Deals">;

  const maxPages =
    typeof body.max_pages === "number" && body.max_pages > 0
      ? body.max_pages
      : 1000;
  const perPage =
    typeof body.per_page === "number" && body.per_page > 0 && body.per_page <= 200
      ? body.per_page
      : 200;

  try {
    const { accessToken, apiDomain } = await getFreshAccessToken(member.org_id);
    const summary: Record<string, unknown> = {};

    for (const module of modules) {
      const rawTable =
        module === "Contacts"
          ? "zoho_contacts_raw"
          : module === "Accounts"
            ? "zoho_accounts_raw"
            : "zoho_deals_raw";
      summary[module] = await pageThroughModule(
        module,
        rawTable,
        member.org_id,
        accessToken,
        apiDomain,
        perPage,
        maxPages,
      );
    }

    return json({ ok: true, modules_synced: modules, summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return createErrorResponse(400, message);
  }
}

async function handlePromote(req: Request, member: Member) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const dryRun = body?.dry_run === true;
  const orgId = member.org_id;

  const [acc, con, deal] = await Promise.all([
    supabaseAdmin
      .from("zoho_accounts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("promoted_at", null),
    supabaseAdmin
      .from("zoho_contacts_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("promoted_at", null),
    supabaseAdmin
      .from("zoho_deals_raw")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("promoted_at", null),
  ]);

  return runPromote(
    orgId,
    dryRun,
    parseModulesParam(body),
    { accounts: acc.count ?? 0, contacts: con.count ?? 0, deals: deal.count ?? 0 },
  );
}

// ---------------------------- promote helpers ----------------------------

type PromoteCounters = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type StageInfo = {
  defaultPipelineId: string;
  defaultStageKey: string;
  wonStageKey: string;
  lostStageKey: string;
  validStages: Set<string>;
};

const pickString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const pickRefId = (value: unknown): string | null => {
  if (value && typeof value === "object" && "id" in value) {
    return pickString((value as { id: unknown }).id);
  }
  return null;
};

const buildAddress = (...parts: Array<unknown>): string | null => {
  const filtered = parts.map((p) => pickString(p)).filter((p): p is string => !!p);
  return filtered.length > 0 ? filtered.join(", ") : null;
};

const buildPhoneJsonb = (entries: Array<{ number: unknown; type: string }>) => {
  const result = entries
    .map((e) => {
      const num = pickString(e.number);
      return num ? { number: num, type: e.type } : null;
    })
    .filter((x): x is { number: string; type: string } => x !== null);
  return result.length > 0 ? result : null;
};

const buildEmailJsonb = (entries: Array<{ email: unknown; type: string }>) => {
  const result = entries
    .map((e) => {
      const em = pickString(e.email);
      return em ? { email: em, type: e.type } : null;
    })
    .filter((x): x is { email: string; type: string } => x !== null);
  return result.length > 0 ? result : null;
};

const mapZohoStage = (zohoStage: string | null, info: StageInfo) => {
  const lower = (zohoStage ?? "").toLowerCase().trim();
  // Closed states first
  if (lower.includes("closed won") || lower === "won") {
    return { stage: info.wonStageKey, lifecycle_phase: "closed" };
  }
  if (lower.includes("closed lost") || lower === "lost") {
    return { stage: info.lostStageKey, lifecycle_phase: "closed" };
  }
  // Try a direct match against any pipeline stage (case insensitive)
  for (const key of info.validStages) {
    if (key.toLowerCase() === lower) {
      return { stage: key, lifecycle_phase: "opportunity" };
    }
  }
  // Heuristic mapping
  if (lower.includes("design")) return { stage: "design", lifecycle_phase: "delivery" };
  if (lower.includes("development") || lower.includes("dev"))
    return { stage: "development", lifecycle_phase: "delivery" };
  if (lower.includes("review")) return { stage: "review", lifecycle_phase: "delivery" };
  if (lower.includes("launch")) return { stage: "launch", lifecycle_phase: "delivery" };
  if (lower.includes("maintenance")) return { stage: "maintenance", lifecycle_phase: "delivery" };
  if (lower.includes("proposal") || lower.includes("quote"))
    return { stage: "proposal_sent", lifecycle_phase: "opportunity" };
  if (lower.includes("discovery") || lower.includes("analysis"))
    return { stage: "discovery", lifecycle_phase: "opportunity" };
  return { stage: info.defaultStageKey, lifecycle_phase: "opportunity" };
};

const safeNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

async function loadStageInfo(orgId: number): Promise<StageInfo> {
  const { data: stages } = await supabaseAdmin
    .from("organization_pipeline_stages")
    .select("pipeline_id, key, is_won, is_lost, order_index")
    .eq("org_id", orgId)
    .order("order_index", { ascending: true });

  const first = stages?.[0];
  const won = stages?.find((s) => s.is_won === true);
  const lost = stages?.find((s) => s.is_lost === true);
  return {
    defaultPipelineId: first?.pipeline_id ?? "default",
    defaultStageKey: first?.key ?? "lead",
    wonStageKey: won?.key ?? "closed_won",
    lostStageKey: lost?.key ?? "closed_lost",
    validStages: new Set((stages ?? []).map((s) => s.key as string)),
  };
}

function parseModulesParam(body: Record<string, unknown>): Array<"Accounts" | "Contacts" | "Deals"> {
  const requested = Array.isArray(body.modules)
    ? (body.modules as unknown[]).filter((m): m is string => typeof m === "string")
    : ["Accounts", "Contacts", "Deals"];
  const ordered: Array<"Accounts" | "Contacts" | "Deals"> = [];
  for (const m of ["Accounts", "Contacts", "Deals"] as const) {
    if (requested.includes(m)) ordered.push(m);
  }
  return ordered;
}

async function promoteAccount(
  orgId: number,
  rawId: number,
  zohoId: string,
  payload: Record<string, unknown>,
  dryRun: boolean,
  counters: PromoteCounters,
) {
  const name = pickString(payload.Account_Name);
  if (!name) {
    counters.skipped += 1;
    return;
  }

  const writable = {
    org_id: orgId,
    zoho_id: zohoId,
    name,
    website: pickString(payload.Website),
    phone_number: pickString(payload.Phone),
    sector: pickString(payload.Industry),
    description: pickString(payload.Description),
    address: buildAddress(
      payload.Billing_Street,
      payload.Billing_City,
      payload.Billing_State,
      payload.Billing_Code,
      payload.Billing_Country,
    ),
    city: pickString(payload.Billing_City),
    state_abbr: pickString(payload.Billing_State)?.slice(0, 6) ?? null,
    zipcode: pickString(payload.Billing_Code),
    country: pickString(payload.Billing_Country),
  };

  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("org_id", orgId)
    .eq("zoho_id", zohoId)
    .maybeSingle();

  if (existing) {
    counters.updated += 1;
    if (!dryRun) {
      await supabaseAdmin.from("companies").update(writable).eq("id", existing.id);
      await supabaseAdmin
        .from("zoho_accounts_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_company_id: existing.id,
        })
        .eq("id", rawId);
    }
    return;
  }

  counters.inserted += 1;
  if (!dryRun) {
    const { data: inserted, error } = await supabaseAdmin
      .from("companies")
      .insert(writable)
      .select("id")
      .single();
    if (error) throw new Error(`insert company: ${error.message}`);
    if (inserted) {
      await supabaseAdmin
        .from("zoho_accounts_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_company_id: inserted.id,
        })
        .eq("id", rawId);
    }
  }
}

async function promoteContact(
  orgId: number,
  rawId: number,
  zohoId: string,
  payload: Record<string, unknown>,
  dryRun: boolean,
  counters: PromoteCounters,
) {
  const firstName = pickString(payload.First_Name);
  const lastName = pickString(payload.Last_Name) ?? pickString(payload.Full_Name) ?? "(no name)";

  // Resolve company via Account reference
  const accountZohoId = pickRefId(payload.Account_Name);
  let companyId: number | null = null;
  if (accountZohoId) {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("org_id", orgId)
      .eq("zoho_id", accountZohoId)
      .maybeSingle();
    companyId = company?.id ?? null;
  }

  const emailJsonb = buildEmailJsonb([
    { email: payload.Email, type: "Work" },
    { email: payload.Secondary_Email, type: "Other" },
  ]);
  const phoneJsonb = buildPhoneJsonb([
    { number: payload.Phone, type: "Work" },
    { number: payload.Mobile, type: "Mobile" },
    { number: payload.Home_Phone, type: "Home" },
  ]);

  const writable = {
    org_id: orgId,
    zoho_id: zohoId,
    first_name: firstName,
    last_name: lastName,
    title: pickString(payload.Title),
    company_id: companyId,
    email_jsonb: emailJsonb,
    phone_jsonb: phoneJsonb,
    address: buildAddress(
      payload.Mailing_Street,
      payload.Mailing_City,
      payload.Mailing_State,
      payload.Mailing_Zip,
      payload.Mailing_Country,
    ),
    background: pickString(payload.Description),
    lead_source: pickString(payload.Lead_Source),
    status: "contact",
  };

  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("org_id", orgId)
    .eq("zoho_id", zohoId)
    .maybeSingle();

  if (existing) {
    counters.updated += 1;
    if (!dryRun) {
      await supabaseAdmin.from("contacts").update(writable).eq("id", existing.id);
      await supabaseAdmin
        .from("zoho_contacts_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_contact_id: existing.id,
        })
        .eq("id", rawId);
    }
    return;
  }

  counters.inserted += 1;
  if (!dryRun) {
    const { data: inserted, error } = await supabaseAdmin
      .from("contacts")
      .insert(writable)
      .select("id")
      .single();
    if (error) throw new Error(`insert contact: ${error.message}`);
    if (inserted) {
      await supabaseAdmin
        .from("zoho_contacts_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_contact_id: inserted.id,
        })
        .eq("id", rawId);
    }
  }
}

async function promoteDeal(
  orgId: number,
  rawId: number,
  zohoId: string,
  payload: Record<string, unknown>,
  stageInfo: StageInfo,
  dryRun: boolean,
  counters: PromoteCounters,
) {
  const name = pickString(payload.Deal_Name) ?? "(unnamed deal)";

  const accountZohoId = pickRefId(payload.Account_Name);
  let companyId: number | null = null;
  if (accountZohoId) {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("org_id", orgId)
      .eq("zoho_id", accountZohoId)
      .maybeSingle();
    companyId = data?.id ?? null;
  }

  const contactZohoId = pickRefId(payload.Contact_Name);
  let contactId: number | null = null;
  if (contactZohoId) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("org_id", orgId)
      .eq("zoho_id", contactZohoId)
      .maybeSingle();
    contactId = data?.id ?? null;
  }

  const amount = safeNumber(payload.Amount);
  const { stage, lifecycle_phase } = mapZohoStage(pickString(payload.Stage), stageInfo);

  const closingRaw = pickString(payload.Closing_Date);
  let expectedClosing: string | null = null;
  if (closingRaw) {
    const parsed = new Date(closingRaw);
    expectedClosing = isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const writable = {
    org_id: orgId,
    zoho_id: zohoId,
    name,
    company_id: companyId,
    contact_id: contactId,
    contact_ids: contactId ? [contactId] : [],
    description: pickString(payload.Description),
    notes: pickString(payload.Description),
    amount: amount != null ? Math.round(amount) : null,
    estimated_value: amount,
    expected_closing_date: expectedClosing,
    pipeline_id: stageInfo.defaultPipelineId,
    stage,
    lifecycle_phase,
    priority: "medium",
    value_includes_material: false,
    website_content: {},
    tech_stack: {},
    salesperson_ids: [],
    subcontractor_ids: [],
    worker_ids: [],
  };

  const { data: existing } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("org_id", orgId)
    .eq("zoho_id", zohoId)
    .maybeSingle();

  if (existing) {
    counters.updated += 1;
    if (!dryRun) {
      // On update, don't reset the workflow defaults set by humans
      const updatable = {
        name: writable.name,
        company_id: writable.company_id,
        contact_id: writable.contact_id,
        contact_ids: writable.contact_ids,
        description: writable.description,
        notes: writable.notes,
        amount: writable.amount,
        estimated_value: writable.estimated_value,
        expected_closing_date: writable.expected_closing_date,
        stage: writable.stage,
        lifecycle_phase: writable.lifecycle_phase,
      };
      await supabaseAdmin.from("deals").update(updatable).eq("id", existing.id);
      await supabaseAdmin
        .from("zoho_deals_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_deal_id: existing.id,
        })
        .eq("id", rawId);
    }
    return;
  }

  counters.inserted += 1;
  if (!dryRun) {
    const { data: inserted, error } = await supabaseAdmin
      .from("deals")
      .insert(writable)
      .select("id")
      .single();
    if (error) throw new Error(`insert deal: ${error.message}`);
    if (inserted) {
      await supabaseAdmin
        .from("zoho_deals_raw")
        .update({
          promoted_at: new Date().toISOString(),
          promoted_deal_id: inserted.id,
        })
        .eq("id", rawId);
    }
  }
}

async function runPromote(
  orgId: number,
  dryRun: boolean,
  modules: Array<"Accounts" | "Contacts" | "Deals">,
  pending: { accounts: number; contacts: number; deals: number },
) {
  const stageInfo = await loadStageInfo(orgId);
  const summary: Record<string, PromoteCounters> = {};

  for (const moduleName of modules) {
    const counters: PromoteCounters = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    summary[moduleName] = counters;
    const rawTable =
      moduleName === "Accounts"
        ? "zoho_accounts_raw"
        : moduleName === "Contacts"
          ? "zoho_contacts_raw"
          : "zoho_deals_raw";

    const { data: rows, error } = await supabaseAdmin
      .from(rawTable)
      .select("id, zoho_id, payload")
      .eq("org_id", orgId)
      .is("promoted_at", null)
      .limit(5000);

    if (error) {
      counters.errors.push(`fetch ${moduleName}: ${error.message}`);
      continue;
    }

    for (const row of rows ?? []) {
      try {
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        if (moduleName === "Accounts") {
          await promoteAccount(orgId, row.id as number, row.zoho_id as string, payload, dryRun, counters);
        } else if (moduleName === "Contacts") {
          await promoteContact(orgId, row.id as number, row.zoho_id as string, payload, dryRun, counters);
        } else {
          await promoteDeal(
            orgId,
            row.id as number,
            row.zoho_id as string,
            payload,
            stageInfo,
            dryRun,
            counters,
          );
        }
      } catch (e: unknown) {
        counters.errors.push(`${row.zoho_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return json({
    ok: true,
    dry_run: dryRun,
    modules,
    pending_before: pending,
    summary,
  });
}

async function handleDisconnect(member: Member) {
  const { error } = await supabaseAdmin
    .from("zoho_oauth_credentials")
    .delete()
    .eq("org_id", member.org_id);
  if (error) return createErrorResponse(400, error.message);
  return json({ ok: true, disconnected: true });
}

// ---------------------------- router ----------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // segments[0] === "zoho_oneshot_import" (function slug from gateway)
  const route = (segments[1] ?? "").toLowerCase();

  // Public health endpoint — no auth, no DB access
  if (req.method === "GET" && route === "health") {
    return handleHealth();
  }

  // Every other endpoint requires admin auth
  const auth = await authenticate(req);
  if ("error" in auth) {
    return createErrorResponse(auth.status, auth.error);
  }
  const { member } = auth;

  try {
    if (req.method === "GET" && (route === "" || route === "status")) {
      return await handleStatus(member);
    }
    if (req.method === "POST" && route === "setup-credentials") {
      return await handleSetupCredentials(req, member);
    }
    if (req.method === "POST" && route === "disconnect") {
      return await handleDisconnect(member);
    }
    if (req.method === "POST" && route === "test-connection") {
      return await handleTestConnection(member);
    }
    if (req.method === "POST" && route === "sync-all") {
      return await handleSyncAll(req, member);
    }
    if (req.method === "POST" && route === "promote") {
      return await handlePromote(req, member);
    }
    return createErrorResponse(404, `Unknown route: ${req.method} /${route}`);
  } catch (e: unknown) {
    console.error("[zoho_oneshot_import] error", e);
    const message = e instanceof Error ? e.message : String(e);
    return createErrorResponse(500, message);
  }
});
