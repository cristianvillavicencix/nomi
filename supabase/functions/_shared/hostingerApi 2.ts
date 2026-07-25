const HOSTINGER_API_BASE = "https://developers.hostinger.com";

export type HostingerDomainResource = {
  id?: number | null;
  domain?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

export type HostingerDnsRecord = {
  name?: string | null;
  type?: string | null;
  ttl?: number | null;
  records?: Array<{
    content?: string | null;
    is_disabled?: boolean | null;
  }> | null;
};

export type HostingerDomainExtended = HostingerDomainResource & {
  is_locked?: boolean | null;
  is_privacy_protected?: boolean | null;
  registered_at?: string | null;
  name_servers?: { ns1?: string; ns2?: string } | null;
};

export type HostingerAvailabilityResult = {
  domain?: string | null;
  is_available?: boolean;
  is_alternative?: boolean;
  restriction?: string | null;
};

export type HostingerCatalogPrice = {
  id?: string;
  name?: string;
  currency?: string;
  price?: number;
  first_period_price?: number;
  period?: number;
  period_unit?: string;
};

export type HostingerCatalogItem = {
  id?: string;
  name?: string;
  category?: string;
  prices?: HostingerCatalogPrice[];
};

export type HostingerAvailabilityEnriched = HostingerAvailabilityResult & {
  tld?: string | null;
  price_cents?: number | null;
  first_period_price_cents?: number | null;
  renewal_price_cents?: number | null;
  currency?: string | null;
  catalog_item_id?: string | null;
  period_label?: string | null;
  is_promotional?: boolean;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message ?? payload.error ?? response.statusText;
  } catch {
    return response.statusText || "Hostinger API request failed";
  }
};

export async function hostingerFetch<T>(
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${HOSTINGER_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function testHostingerConnection(apiToken: string) {
  await hostingerFetch<HostingerDomainResource[]>(
    apiToken,
    "/api/domains/v1/portfolio",
    { method: "GET" },
  );
  return { ok: true as const };
}

export async function fetchHostingerPortfolio(apiToken: string) {
  return hostingerFetch<HostingerDomainResource[]>(
    apiToken,
    "/api/domains/v1/portfolio",
    { method: "GET" },
  );
}

export async function fetchHostingerDomainDetails(
  apiToken: string,
  domain: string,
) {
  return hostingerFetch<HostingerDomainExtended>(
    apiToken,
    `/api/domains/v1/portfolio/${encodeURIComponent(domain)}`,
    { method: "GET" },
  );
}

export async function fetchHostingerDnsRecords(
  apiToken: string,
  domain: string,
) {
  return hostingerFetch<HostingerDnsRecord[]>(
    apiToken,
    `/api/dns/v1/zones/${encodeURIComponent(domain)}`,
    { method: "GET" },
  );
}

export async function fetchHostingerDomainCatalog(apiToken: string) {
  return hostingerFetch<HostingerCatalogItem[]>(
    apiToken,
    "/api/billing/v1/catalog?category=DOMAIN",
    { method: "GET" },
  );
}

const extractTld = (domain?: string | null) => {
  const normalized = domain?.trim().toLowerCase() ?? "";
  if (!normalized.includes(".")) return null;
  return normalized.split(".").pop() ?? null;
};

const normalizeTldKey = (value: string) =>
  value.trim().toLowerCase().replace(/^\./, "");

const formatPeriodLabel = (price?: HostingerCatalogPrice | null) => {
  if (!price?.period || !price.period_unit) return null;
  const unit = price.period_unit.toLowerCase();
  if (price.period === 1) {
    if (unit === "year") return "1 year";
    if (unit === "month") return "1 month";
  }
  return `${price.period} ${unit}${price.period > 1 ? "s" : ""}`;
};

const pickCatalogPriceForTld = (
  catalog: HostingerCatalogItem[],
  tld: string,
) => {
  const needle = normalizeTldKey(tld);
  const item = catalog.find((entry) => {
    const name = entry.name?.trim().toLowerCase() ?? "";
    return (
      name === `.${needle}` ||
      name === needle ||
      name.endsWith(`.${needle}`) ||
      name.includes(`.${needle}`)
    );
  });
  if (!item?.prices?.length) return null;

  const yearlyRenewal = item.prices.find(
    (price) => price.period_unit === "year" && price.period === 1,
  );

  let bestIntroRow: HostingerCatalogPrice | null = null;
  let bestIntroCents: number | null = null;

  for (const priceRow of item.prices) {
    const introCents = priceRow.first_period_price ?? priceRow.price;
    if (introCents == null) continue;
    if (bestIntroCents == null || introCents < bestIntroCents) {
      bestIntroCents = introCents;
      bestIntroRow = priceRow;
    }
  }

  const introRow = bestIntroRow ?? yearlyRenewal ?? item.prices[0] ?? null;
  if (!introRow) return null;

  const standardYearCents = yearlyRenewal?.first_period_price ??
    yearlyRenewal?.price ??
    null;
  const introCents = introRow.first_period_price ?? introRow.price ?? null;

  return {
    introRow,
    renewalCents: yearlyRenewal?.price ?? introRow.price ?? null,
    isPromotional: standardYearCents != null &&
      introCents != null &&
      introCents < standardYearCents,
  };
};

export async function enrichAvailabilityWithCatalog(
  apiToken: string,
  results: HostingerAvailabilityResult[],
) {
  const catalog = await fetchHostingerDomainCatalog(apiToken).catch(() => []);

  return results.map((result): HostingerAvailabilityEnriched => {
    const tld = extractTld(result.domain);
    const pricing = tld ? pickCatalogPriceForTld(catalog, tld) : null;
    const priceRow = pricing?.introRow ?? null;

    return {
      ...result,
      tld,
      price_cents: priceRow?.price ?? null,
      first_period_price_cents: priceRow?.first_period_price ?? priceRow?.price ?? null,
      renewal_price_cents: pricing?.renewalCents ?? priceRow?.price ?? null,
      currency: priceRow?.currency ?? null,
      catalog_item_id: priceRow?.id ?? null,
      period_label: formatPeriodLabel(priceRow),
      is_promotional: pricing?.isPromotional === true,
    };
  });
}

export async function checkHostingerAvailability(
  apiToken: string,
  params: {
    domain: string;
    tlds: string[];
    withAlternatives?: boolean;
  },
) {
  return hostingerFetch<HostingerAvailabilityResult[]>(
    apiToken,
    "/api/domains/v1/availability",
    {
      method: "POST",
      body: JSON.stringify({
        domain: params.domain,
        tlds: params.tlds,
        with_alternatives: params.withAlternatives ?? true,
      }),
    },
  );
}

export const hostnameFromWebsiteUrl = (rawUrl: string | null | undefined) => {
  const trimmed = rawUrl?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const hostname = new URL(candidate).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};
