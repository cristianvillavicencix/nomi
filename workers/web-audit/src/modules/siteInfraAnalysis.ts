export type WafDetection = {
  detected: boolean;
  providers: string[];
  signals: string[];
};

export type HttpSecurityHeaders = {
  strictTransportSecurity: boolean;
  contentSecurityPolicy: boolean;
  xRobotsTag: string | null;
  xFrameOptions: string | null;
  permissionsPolicy: boolean;
  noindexHeader: boolean;
};

export type SiteInfraAnalysis = {
  waf: WafDetection;
  headers: HttpSecurityHeaders;
  headerSample: Record<string, string>;
};

const normalizeHeaders = (headers: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
};

export const detectWaf = (headers: Record<string, string>): WafDetection => {
  const h = normalizeHeaders(headers);
  const providers = new Set<string>();
  const signals: string[] = [];

  if (h["cf-ray"] || h["cf-cache-status"]) {
    providers.add("Cloudflare");
    signals.push("cf-ray");
  }
  if (h["x-sucuri-id"] || h["x-sucuri-cache"]) {
    providers.add("Sucuri");
    signals.push("x-sucuri");
  }
  if (/wordfence/i.test(h["server"] ?? "") || h["x-wordfence"]) {
    providers.add("Wordfence");
    signals.push("wordfence");
  }
  if (/cloudflare/i.test(h["server"] ?? "")) {
    providers.add("Cloudflare");
    signals.push("server-cloudflare");
  }
  if (h["x-akamai-transformed"]) {
    providers.add("Akamai");
    signals.push("akamai");
  }
  if (h["x-iinfo"] || h["x-cdn"]) {
    providers.add("Imperva/Incapsula");
    signals.push("imperva");
  }
  if (h["x-powered-by"]?.includes("WP Engine")) {
    providers.add("WP Engine");
    signals.push("wp-engine");
  }

  return {
    detected: providers.size > 0,
    providers: [...providers],
    signals: [...new Set(signals)],
  };
};

export const analyzeHttpSecurityHeaders = (
  headers: Record<string, string>,
): HttpSecurityHeaders => {
  const h = normalizeHeaders(headers);
  const xRobots = h["x-robots-tag"] ?? null;

  return {
    strictTransportSecurity: Boolean(h["strict-transport-security"]),
    contentSecurityPolicy: Boolean(h["content-security-policy"]),
    xRobotsTag: xRobots,
    xFrameOptions: h["x-frame-options"] ?? null,
    permissionsPolicy: Boolean(h["permissions-policy"] || h["feature-policy"]),
    noindexHeader: xRobots?.toLowerCase().includes("noindex") ?? false,
  };
};

export const analyzeSiteInfra = (
  headers: Record<string, string>,
): SiteInfraAnalysis => {
  const normalized = normalizeHeaders(headers);
  const sample: Record<string, string> = {};
  for (const key of [
    "server",
    "x-powered-by",
    "strict-transport-security",
    "content-security-policy",
    "x-robots-tag",
    "x-frame-options",
    "cf-ray",
    "x-sucuri-id",
  ]) {
    if (normalized[key]) sample[key] = normalized[key].slice(0, 200);
  }

  return {
    waf: detectWaf(headers),
    headers: analyzeHttpSecurityHeaders(headers),
    headerSample: sample,
  };
};
