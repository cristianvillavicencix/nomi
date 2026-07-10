import { supabaseAdmin } from "./supabaseAdmin.ts";
import {
  fetchHostingerPortfolio,
  hostnameFromWebsiteUrl,
  type HostingerDomainResource,
} from "./hostingerApi.ts";
import {
  getHostingerApiToken,
  updateHostingerSyncMetadata,
} from "./hostingerSettings.ts";

const normalizeDomain = (value: string | null | undefined) => {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
};

const buildCompanyHostnameMap = async (orgId: number) => {
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id, website")
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to load companies for domain linking");
  }

  const map = new Map<string, number>();
  for (const company of companies ?? []) {
    const hostname = hostnameFromWebsiteUrl(company.website);
    if (hostname && !map.has(hostname)) {
      map.set(hostname, Number(company.id));
    }
  }
  return map;
};

const toUpsertRow = (
  orgId: number,
  item: HostingerDomainResource,
  companyId: number | null,
  syncedAt: string,
) => {
  const domain = normalizeDomain(item.domain);
  if (!domain) return null;

  return {
    org_id: orgId,
    hostinger_id: item.id ?? null,
    domain,
    domain_type: item.type ?? null,
    status: item.status ?? "active",
    expires_at: item.expires_at ?? null,
    company_id: companyId,
    metadata: item,
    synced_at: syncedAt,
    updated_at: syncedAt,
  };
};

type HostingerUpsertRow = NonNullable<ReturnType<typeof toUpsertRow>>;

const statusRank = (status: string) => {
  if (status === "active") return 3;
  if (status === "pending_setup" || status === "pending_verification") return 2;
  if (status === "expired" || status === "deleted" || status === "failed") {
    return 0;
  }
  return 1;
};

const pickBetterDomainRow = (
  current: HostingerUpsertRow,
  candidate: HostingerUpsertRow,
) => {
  const currentRank = statusRank(current.status);
  const candidateRank = statusRank(candidate.status);
  if (candidateRank !== currentRank) {
    return candidateRank > currentRank ? candidate : current;
  }

  const currentExpiry = current.expires_at
    ? new Date(current.expires_at).getTime()
    : 0;
  const candidateExpiry = candidate.expires_at
    ? new Date(candidate.expires_at).getTime()
    : 0;
  if (candidateExpiry !== currentExpiry) {
    return candidateExpiry > currentExpiry ? candidate : current;
  }

  return (candidate.hostinger_id ?? 0) >= (current.hostinger_id ?? 0)
    ? candidate
    : current;
};

const dedupeDomainRows = (rows: HostingerUpsertRow[]) => {
  const byDomain = new Map<string, HostingerUpsertRow>();
  for (const row of rows) {
    const existing = byDomain.get(row.domain);
    byDomain.set(
      row.domain,
      existing ? pickBetterDomainRow(existing, row) : row,
    );
  }
  return Array.from(byDomain.values());
};

export async function syncHostingerDomainsForOrg(
  _user: { id: string } | null,
  orgId: number,
) {
  const apiToken = await getHostingerApiToken(orgId);
  if (!apiToken) {
    throw new Error("Hostinger API token is not configured");
  }

  const syncedAt = new Date().toISOString();
  const portfolio = await fetchHostingerPortfolio(apiToken);
  const companyByHostname = await buildCompanyHostnameMap(orgId);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("hostinger_domains")
    .select("domain, company_id")
    .eq("org_id", orgId);

  if (existingError) {
    throw new Error(
      existingError.message ?? "Failed to load existing Hostinger domains",
    );
  }

  const existingCompanyByDomain = new Map(
    (existingRows ?? []).map((row) => [row.domain, row.company_id as number | null]),
  );

  const rows = dedupeDomainRows(
    (portfolio ?? [])
      .map((item) => {
        const domain = normalizeDomain(item.domain);
        if (!domain) return null;
        const preservedCompanyId = existingCompanyByDomain.get(domain) ?? null;
        const companyId =
          preservedCompanyId ?? companyByHostname.get(domain) ?? null;
        return toUpsertRow(orgId, item, companyId, syncedAt);
      })
      .filter((row): row is HostingerUpsertRow => row !== null),
  );

  const activeDomainSet = new Set(rows.map((row) => row.domain));

  if (rows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("hostinger_domains")
      .upsert(rows, { onConflict: "org_id,domain" });

    if (upsertError) {
      throw new Error(upsertError.message ?? "Failed to save Hostinger domains");
    }
  }

  const staleIds = (existingRows ?? [])
    .filter((row) => !activeDomainSet.has(row.domain))
    .map((row) => row.domain);

  if (staleIds.length > 0) {
    const { error: pruneError } = await supabaseAdmin
      .from("hostinger_domains")
      .delete()
      .eq("org_id", orgId)
      .in("domain", staleIds);

    if (pruneError) {
      throw new Error(
        pruneError.message ?? "Failed to prune stale Hostinger domains",
      );
    }
  } else if (rows.length === 0) {
    const { error: clearError } = await supabaseAdmin
      .from("hostinger_domains")
      .delete()
      .eq("org_id", orgId);

    if (clearError) {
      throw new Error(clearError.message ?? "Failed to clear Hostinger domains");
    }
  }

  await updateHostingerSyncMetadata(orgId, {
    last_synced_at: syncedAt,
    last_sync_error: null,
  });

  return {
    ok: true as const,
    synced: rows.length,
    synced_at: syncedAt,
  };
}
