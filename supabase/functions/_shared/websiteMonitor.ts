export type WebsiteMonitorStatus = "up" | "slow" | "down";

export type WebsiteMonitorSiteRow = {
  id: number;
  org_id: number;
  url: string;
  display_name?: string | null;
  slow_threshold_ms: number;
  is_enabled: boolean;
  check_interval_minutes: number;
  last_checked_at: string | null;
  last_status?: string | null;
  check_paths?: string[] | null;
  page_title?: string | null;
  hosting_provider?: string | null;
  tech_stack?: string[] | null;
  ssl_days_remaining?: number | null;
  dns_ip?: string | null;
  alert_on_down?: boolean | null;
  alert_on_slow?: boolean | null;
  alert_on_ssl?: boolean | null;
  last_alert_sent_at?: string | null;
  last_alert_status?: string | null;
};

export type PageCheckResult = {
  path: string;
  url: string;
  status: WebsiteMonitorStatus;
  responseMs: number | null;
  httpStatus: number | null;
  errorMessage: string | null;
};

export type WebsiteCheckMetadata = {
  dns?: {
    ip?: string | null;
    nameservers?: string[];
    mx?: string[];
    reverseDns?: string | null;
    registrar?: string | null;
  };
  hosting?: {
    provider?: string | null;
    confidence?: "low" | "medium" | "high" | null;
  };
  tech?: string[];
  headers?: Record<string, string>;
  finalUrl?: string | null;
  pageTitle?: string | null;
  pages?: PageCheckResult[];
  httpsRedirect?: boolean | null;
};

export type WebsiteCheckResult = {
  status: WebsiteMonitorStatus;
  responseMs: number;
  httpStatus: number | null;
  errorMessage: string | null;
  sslExpiresAt: string | null;
  sslDaysRemaining: number | null;
  metadata: WebsiteCheckMetadata;
  dnsIp: string | null;
  dnsNameservers: string[];
  dnsMx: string[];
  hostingProvider: string | null;
  hostingConfidence: "low" | "medium" | "high" | null;
  techStack: string[];
  pageTitle: string | null;
  domainName: string | null;
};

export const normalizeMonitorUrl = (raw?: string | null): string | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return candidate.replace(/\/+$/, "") || candidate;
  } catch {
    return null;
  }
};

export const extractDomainFromUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
};

const extractHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const extractPageTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = match?.[1]?.trim();
  return title ? title.slice(0, 200) : null;
};

const detectHosting = (headers: Headers): WebsiteCheckMetadata["hosting"] => {
  const server = headers.get("server")?.toLowerCase() ?? "";
  const via = headers.get("via")?.toLowerCase() ?? "";
  const poweredBy = headers.get("x-powered-by")?.toLowerCase() ?? "";

  if (headers.get("cf-ray") || server.includes("cloudflare")) {
    return { provider: "Cloudflare", confidence: "high" };
  }
  if (headers.get("x-vercel-id") || via.includes("vercel")) {
    return { provider: "Vercel", confidence: "high" };
  }
  if (headers.get("x-nf-request-id") || server.includes("netlify")) {
    return { provider: "Netlify", confidence: "high" };
  }
  if (headers.get("x-amz-request-id") || server.includes("amazon")) {
    return { provider: "AWS", confidence: "medium" };
  }
  if (headers.get("x-github-request-id")) {
    return { provider: "GitHub Pages", confidence: "high" };
  }
  if (
    server.includes("hcdn") ||
    server.includes("hostinger") ||
    poweredBy.includes("hostinger")
  ) {
    return { provider: "Hostinger", confidence: "high" };
  }
  if (server.includes("litespeed") || poweredBy.includes("litespeed")) {
    return { provider: "LiteSpeed", confidence: "medium" };
  }
  if (server.includes("openresty")) {
    return { provider: "OpenResty", confidence: "low" };
  }
  if (server.includes("nginx")) {
    return { provider: "Nginx", confidence: "low" };
  }
  if (server.includes("apache")) {
    return { provider: "Apache", confidence: "low" };
  }
  if (server) {
    return { provider: server, confidence: "low" };
  }
  return null;
};

const detectRegistrarFromNameservers = (
  nameservers: string[],
): string | null => {
  const joined = nameservers.join(" ").toLowerCase();
  if (joined.includes("cloudflare")) return "Cloudflare";
  if (joined.includes("domaincontrol") || joined.includes("godaddy")) {
    return "GoDaddy";
  }
  if (joined.includes("google")) return "Google Domains";
  if (joined.includes("namecheap")) return "Namecheap";
  if (joined.includes("awsdns") || joined.includes("amazon")) return "AWS Route53";
  if (joined.includes("wix")) return "Wix";
  if (joined.includes("squarespace")) return "Squarespace";
  if (joined.includes("hostgator")) return "HostGator";
  if (joined.includes("bluehost")) return "Bluehost";
  return null;
};

const detectTech = (html: string, headers: Headers): string[] => {
  const found = new Set<string>();
  const lower = html.slice(0, 150_000).toLowerCase();

  if (lower.includes("wp-content") || lower.includes("wordpress")) {
    found.add("WordPress");
  }
  if (lower.includes("__next_data__") || lower.includes("/_next/static")) {
    found.add("Next.js");
  }
  if (lower.includes("react-root") || lower.includes("data-reactroot")) {
    found.add("React");
  }
  if (lower.includes("vue-app") || lower.includes("__vue__")) {
    found.add("Vue.js");
  }
  if (lower.includes("gatsby")) found.add("Gatsby");
  if (lower.includes("webflow")) found.add("Webflow");
  if (lower.includes("wix.com") || lower.includes("static.wixstatic.com")) {
    found.add("Wix");
  }
  if (lower.includes("squarespace")) found.add("Squarespace");
  if (lower.includes("shopify")) found.add("Shopify");
  if (lower.includes("elementor")) found.add("Elementor");
  if (lower.includes("woocommerce")) found.add("WooCommerce");
  if (lower.includes("bootstrap")) found.add("Bootstrap");
  if (lower.includes("tailwind")) found.add("Tailwind CSS");

  const poweredBy = headers.get("x-powered-by");
  if (poweredBy) found.add(poweredBy);

  const generator = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i,
  );
  if (generator?.[1]) found.add(generator[1]);

  return [...found];
};

const fetchDnsMetadata = async (
  hostname: string,
): Promise<WebsiteCheckMetadata["dns"]> => {
  const query = async (name: string, type: string) => {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (!response.ok) return null;
    return response.json();
  };

  const [aRecord, nsRecord, mxRecord] = await Promise.all([
    query(hostname, "A"),
    query(hostname, "NS"),
    query(hostname, "MX"),
  ]);

  const ip = aRecord?.Answer?.find((entry: { type?: number }) => entry.type === 1)
    ?.data as string | undefined;

  const nameservers =
    nsRecord?.Answer?.filter((entry: { type?: number }) => entry.type === 2)
      .map((entry: { data?: string }) => entry.data?.replace(/\.$/, ""))
      .filter(Boolean) ?? [];

  const mx =
    mxRecord?.Answer?.filter((entry: { type?: number }) => entry.type === 15)
      .map((entry: { data?: string }) => entry.data?.replace(/\.$/, ""))
      .filter(Boolean) ?? [];

  return {
    ip: ip ?? null,
    nameservers,
    mx,
    reverseDns: null,
    registrar: detectRegistrarFromNameservers(nameservers),
  };
};

const fetchSslExpiry = async (
  hostname: string,
): Promise<{ expiresAt: string | null; daysRemaining: number | null }> => {
  try {
    const response = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return { expiresAt: null, daysRemaining: null };
    const rows = (await response.json()) as Array<{ not_after?: string }>;
    const future = rows
      .map((row) => row.not_after)
      .filter(Boolean)
      .map((value) => new Date(String(value)))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > Date.now())
      .sort((a, b) => a.getTime() - b.getTime());

    if (!future.length) return { expiresAt: null, daysRemaining: null };

    const expiresAt = future[0].toISOString();
    const daysRemaining = Math.ceil(
      (future[0].getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return { expiresAt, daysRemaining };
  } catch {
    return { expiresAt: null, daysRemaining: null };
  }
};

const statusRank = (status: WebsiteMonitorStatus) => {
  if (status === "down") return 3;
  if (status === "slow") return 2;
  return 1;
};

const worstStatus = (
  statuses: WebsiteMonitorStatus[],
): WebsiteMonitorStatus => {
  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "slow")) return "slow";
  return "up";
};

const MONITOR_USER_AGENT =
  "Mozilla/5.0 (compatible; Nomi-Website-Monitor/1.0; +https://lbs.bz)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type FetchPageResult = {
  httpStatus: number | null;
  errorMessage: string | null;
  html: string;
  headers: Headers;
  finalUrl: string | null;
  responseMs: number;
  status: WebsiteMonitorStatus;
  requestedUrl: string;
};

const isSuccessfulFetch = (result: FetchPageResult) =>
  !result.errorMessage && result.httpStatus != null && result.httpStatus < 500;

const isTransientFetchError = (message: string) =>
  /connection reset|timed out|timeout|abort|connect|dns|network|unexpected eof|broken pipe/i.test(
    message,
  );

const alternateHostUrl = (targetUrl: string): string | null => {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.toLowerCase();
    parsed.hostname = hostname.startsWith("www.")
      ? hostname.slice(4)
      : `www.${hostname}`;
    return parsed.toString();
  } catch {
    return null;
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPageOnce = async (
  targetUrl: string,
  slowThresholdMs: number,
  timeoutMs: number,
  userAgent: string,
): Promise<FetchPageResult> => {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let html = "";
  let headers = new Headers();
  let finalUrl: string | null = null;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    httpStatus = response.status;
    headers = response.headers;
    finalUrl = response.url;
    html = await response.text();
    if (httpStatus >= 500) {
      errorMessage = `HTTP ${httpStatus}`;
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Request failed";
  } finally {
    clearTimeout(timeout);
  }

  const responseMs = Math.round(performance.now() - started);
  let status: WebsiteMonitorStatus = "down";
  if (!errorMessage && httpStatus != null && httpStatus < 500) {
    status = responseMs >= slowThresholdMs ? "slow" : "up";
  }

  return {
    httpStatus,
    errorMessage,
    html,
    headers,
    finalUrl,
    responseMs,
    status,
    requestedUrl: targetUrl,
  };
};

const fetchPage = async (
  targetUrl: string,
  slowThresholdMs: number,
  timeoutMs = 15_000,
): Promise<FetchPageResult> => {
  const candidates = [targetUrl];
  const alternate = alternateHostUrl(targetUrl);
  if (alternate && alternate !== targetUrl) {
    candidates.push(alternate);
  }

  let lastResult: FetchPageResult | null = null;

  for (const candidateUrl of candidates) {
    for (const userAgent of [MONITOR_USER_AGENT, BROWSER_USER_AGENT]) {
      const result = await fetchPageOnce(
        candidateUrl,
        slowThresholdMs,
        timeoutMs,
        userAgent,
      );
      lastResult = result;
      if (isSuccessfulFetch(result)) {
        return result;
      }
      if (
        result.httpStatus != null ||
        !isTransientFetchError(result.errorMessage ?? "")
      ) {
        break;
      }
      await delay(750);
    }
  }

  return lastResult ?? {
    httpStatus: null,
    errorMessage: "Request failed",
    html: "",
    headers: new Headers(),
    finalUrl: null,
    responseMs: 0,
    status: "down",
    requestedUrl: targetUrl,
  };
};

const buildTargetUrl = (baseUrl: string, path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    const base = new URL(baseUrl);
    return `${base.origin}${normalizedPath}`;
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;
  }
};

export const runWebsiteMonitorCheck = async (
  site: WebsiteMonitorSiteRow,
  options?: { includeDeepMetadata?: boolean },
): Promise<WebsiteCheckResult> => {
  const includeDeepMetadata = options?.includeDeepMetadata ?? true;
  const paths = (site.check_paths?.length ? site.check_paths : ["/"]).slice(0, 6);

  const pageResults: PageCheckResult[] = [];
  let primaryHtml = "";
  let primaryHeaders = new Headers();
  let primaryFinalUrl: string | null = null;
  let primaryHttpStatus: number | null = null;
  let primaryError: string | null = null;
  let primaryResponseMs = 0;

  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    const targetUrl = buildTargetUrl(site.url, path);
    const result = await fetchPage(targetUrl, site.slow_threshold_ms);

    pageResults.push({
      path,
      url: targetUrl,
      status: result.status,
      responseMs: result.errorMessage ? null : result.responseMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
    });

    if (index === 0) {
      primaryHtml = result.html;
      primaryHeaders = result.headers;
      primaryFinalUrl = result.finalUrl;
      primaryHttpStatus = result.httpStatus;
      primaryError = result.errorMessage;
      primaryResponseMs = result.responseMs;
    }
  }

  const status = worstStatus(pageResults.map((page) => page.status));
  const pageTitle = extractPageTitle(primaryHtml);
  const hostname = extractHostname(primaryFinalUrl ?? site.url);
  const domainName = extractDomainFromUrl(site.url);
  const hosting = detectHosting(primaryHeaders);
  const tech = detectTech(primaryHtml, primaryHeaders);

  let metadata: WebsiteCheckMetadata = {
    finalUrl: primaryFinalUrl,
    pageTitle,
    pages: pageResults,
    hosting: hosting ?? undefined,
    tech,
    headers: {
      server: primaryHeaders.get("server") ?? undefined,
      "x-powered-by": primaryHeaders.get("x-powered-by") ?? undefined,
    },
  };

  let sslExpiresAt: string | null = null;
  let sslDaysRemaining: number | null = null;
  let dnsIp: string | null = null;
  let dnsNameservers: string[] = [];
  let dnsMx: string[] = [];

  if (includeDeepMetadata && hostname) {
    const [dns, ssl] = await Promise.all([
      fetchDnsMetadata(hostname).catch(() => null),
      fetchSslExpiry(hostname).catch(() => ({
        expiresAt: null,
        daysRemaining: null,
      })),
    ]);

    metadata = {
      ...metadata,
      dns: dns ?? undefined,
      httpsRedirect: site.url.startsWith("http://")
        ? primaryFinalUrl?.startsWith("https://") ?? null
        : null,
    };
    sslExpiresAt = ssl.expiresAt;
    sslDaysRemaining = ssl.daysRemaining;
    dnsIp = dns?.ip ?? null;
    dnsNameservers = dns?.nameservers ?? [];
    dnsMx = dns?.mx ?? [];
  }

  return {
    status,
    responseMs: primaryResponseMs,
    httpStatus: primaryHttpStatus,
    errorMessage: primaryError,
    sslExpiresAt,
    sslDaysRemaining,
    metadata,
    dnsIp,
    dnsNameservers,
    dnsMx,
    hostingProvider: hosting?.provider ?? null,
    hostingConfidence: hosting?.confidence ?? null,
    techStack: tech,
    pageTitle,
    domainName,
  };
};

export const isWebsiteDueForCheck = (
  site: WebsiteMonitorSiteRow,
  now = Date.now(),
) => {
  if (!site.is_enabled) return false;
  if (!site.last_checked_at) return true;
  const last = new Date(site.last_checked_at).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= site.check_interval_minutes * 60_000;
};

export type WebsiteChangeInput = {
  change_type: string;
  previous_value: string | null;
  new_value: string | null;
};

export const detectWebsiteChanges = (
  previous: WebsiteMonitorSiteRow,
  result: WebsiteCheckResult,
): WebsiteChangeInput[] => {
  const changes: WebsiteChangeInput[] = [];

  if (
    previous.last_status &&
    previous.last_status !== "unknown" &&
    previous.last_status !== result.status
  ) {
    changes.push({
      change_type: "status",
      previous_value: previous.last_status,
      new_value: result.status,
    });
  }

  if (
    previous.page_title &&
    result.pageTitle &&
    previous.page_title !== result.pageTitle
  ) {
    changes.push({
      change_type: "page_title",
      previous_value: previous.page_title,
      new_value: result.pageTitle,
    });
  }

  if (
    previous.hosting_provider &&
    result.hostingProvider &&
    previous.hosting_provider !== result.hostingProvider
  ) {
    changes.push({
      change_type: "hosting",
      previous_value: previous.hosting_provider,
      new_value: result.hostingProvider,
    });
  }

  const prevTech = (previous.tech_stack ?? []).slice().sort().join(", ");
  const nextTech = result.techStack.slice().sort().join(", ");
  if (prevTech && nextTech && prevTech !== nextTech) {
    changes.push({
      change_type: "tech_stack",
      previous_value: prevTech,
      new_value: nextTech,
    });
  }

  if (
    previous.ssl_days_remaining != null &&
    result.sslDaysRemaining != null &&
    Math.abs(previous.ssl_days_remaining - result.sslDaysRemaining) >= 7
  ) {
    changes.push({
      change_type: "ssl",
      previous_value: String(previous.ssl_days_remaining),
      new_value: String(result.sslDaysRemaining),
    });
  }

  if (previous.dns_ip && result.dnsIp && previous.dns_ip !== result.dnsIp) {
    changes.push({
      change_type: "dns",
      previous_value: previous.dns_ip,
      new_value: result.dnsIp,
    });
  }

  return changes;
};
