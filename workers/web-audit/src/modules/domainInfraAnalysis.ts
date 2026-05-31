import { config } from "../config.js";

export type DomainDnsAnalysis = {
  ip: string | null;
  nameservers: string[];
  mx: string[];
  registrar: string | null;
};

export type DomainEmailAuthAnalysis = {
  spf: boolean;
  dmarc: boolean;
  spfRecord: string | null;
  dmarcRecord: string | null;
};

export type DomainSslAnalysis = {
  expiresAt: string | null;
  daysRemaining: number | null;
  ok: boolean;
};

export type DomainHostVariantAnalysis = {
  primaryUrl: string;
  alternateUrl: string | null;
  alternateStatus: number | null;
  alternateFinalUrl: string | null;
  canonicalHost: "www" | "apex" | "mixed" | "unknown";
  hostsMatch: boolean;
  note: string | null;
};

export type DomainInfraAnalysis = {
  hostname: string;
  dns: DomainDnsAnalysis;
  emailAuth: DomainEmailAuthAnalysis;
  ssl: DomainSslAnalysis;
  hostVariant: DomainHostVariantAnalysis;
};

const detectRegistrarFromNameservers = (nameservers: string[]) => {
  const joined = nameservers.join(" ").toLowerCase();
  if (joined.includes("cloudflare")) return "Cloudflare";
  if (joined.includes("googledomains") || joined.includes("google.com"))
    return "Google Domains";
  if (joined.includes("domaincontrol") || joined.includes("godaddy"))
    return "GoDaddy";
  if (joined.includes("awsdns") || joined.includes("amazon"))
    return "AWS Route53";
  if (joined.includes("namecheap")) return "Namecheap";
  if (joined.includes("registrar-servers")) return "Namecheap";
  return null;
};

const dnsQuery = async (name: string, type: string, signal: AbortSignal) => {
  const response = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    {
      signal,
      headers: { Accept: "application/dns-json" },
    },
  );
  if (!response.ok) return null;
  return response.json() as Promise<{
    Answer?: Array<{ type?: number; data?: string }>;
  }>;
};

const fetchDns = async (
  hostname: string,
  signal: AbortSignal,
): Promise<DomainDnsAnalysis> => {
  try {
    const [aRecord, nsRecord, mxRecord] = await Promise.all([
      dnsQuery(hostname, "A", signal),
      dnsQuery(hostname, "NS", signal),
      dnsQuery(hostname, "MX", signal),
    ]);

    const ip = aRecord?.Answer?.find((entry) => entry.type === 1)?.data ?? null;

    const nameservers =
      nsRecord?.Answer?.filter((entry) => entry.type === 2)
        .map((entry) => entry.data?.replace(/\.$/, "") ?? "")
        .filter(Boolean) ?? [];

    const mx =
      mxRecord?.Answer?.filter((entry) => entry.type === 15)
        .map((entry) => entry.data?.replace(/\.$/, "") ?? "")
        .filter(Boolean) ?? [];

    return {
      ip,
      nameservers,
      mx,
      registrar: detectRegistrarFromNameservers(nameservers),
    };
  } catch {
    return { ip: null, nameservers: [], mx: [], registrar: null };
  }
};

const fetchTxtRecords = async (name: string, signal: AbortSignal) => {
  const result = await dnsQuery(name, "TXT", signal);
  return (
    result?.Answer?.filter((entry) => entry.type === 16)
      .map((entry) => entry.data?.replace(/^"|"$/g, "") ?? "")
      .filter(Boolean) ?? []
  );
};

const fetchEmailAuth = async (
  hostname: string,
  signal: AbortSignal,
): Promise<DomainEmailAuthAnalysis> => {
  try {
    const [rootTxt, dmarcTxt] = await Promise.all([
      fetchTxtRecords(hostname, signal),
      fetchTxtRecords(`_dmarc.${hostname}`, signal),
    ]);

    const spfRecord =
      rootTxt.find((record) => /^v=spf1/i.test(record)) ?? null;
    const dmarcRecord =
      dmarcTxt.find((record) => /^v=DMARC1/i.test(record)) ?? null;

    return {
      spf: Boolean(spfRecord),
      dmarc: Boolean(dmarcRecord),
      spfRecord,
      dmarcRecord,
    };
  } catch {
    return {
      spf: false,
      dmarc: false,
      spfRecord: null,
      dmarcRecord: null,
    };
  }
};

const fetchSsl = async (
  hostname: string,
  signal: AbortSignal,
): Promise<DomainSslAnalysis> => {
  try {
    const response = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`,
      {
        signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      return { expiresAt: null, daysRemaining: null, ok: false };
    }

    const rows = (await response.json()) as Array<{ not_after?: string }>;
    const future = rows
      .map((row) => row.not_after)
      .filter(Boolean)
      .map((value) => new Date(String(value)))
      .filter(
        (date) => !Number.isNaN(date.getTime()) && date.getTime() > Date.now(),
      )
      .sort((a, b) => a.getTime() - b.getTime());

    if (!future.length) {
      return { expiresAt: null, daysRemaining: null, ok: false };
    }

    const expiresAt = future[0]!.toISOString();
    const daysRemaining = Math.ceil(
      (future[0]!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return {
      expiresAt,
      daysRemaining,
      ok: daysRemaining > 14,
    };
  } catch {
    return { expiresAt: null, daysRemaining: null, ok: false };
  }
};

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

const probeHostVariant = async (
  primaryUrl: string,
  signal: AbortSignal,
): Promise<DomainHostVariantAnalysis> => {
  const parsed = new URL(primaryUrl);
  const hostname = parsed.hostname.toLowerCase();
  const isWww = hostname.startsWith("www.");
  const alternateUrl = alternateHostUrl(primaryUrl);

  let alternateStatus: number | null = null;
  let alternateFinalUrl: string | null = null;

  if (alternateUrl) {
    try {
      const response = await fetch(alternateUrl, {
        signal,
        redirect: "follow",
        headers: {
          "User-Agent": config.userAgent,
          Accept: "text/html,*/*",
        },
      });
      alternateStatus = response.status;
      alternateFinalUrl = response.url;
    } catch {
      alternateStatus = null;
    }
  }

  const primaryHost = parsed.hostname.toLowerCase();
  const altHost = alternateFinalUrl
    ? new URL(alternateFinalUrl).hostname.toLowerCase()
    : null;

  const hostsMatch =
    Boolean(altHost) &&
    (altHost === primaryHost ||
      (altHost ?? "").replace(/^www\./, "") === primaryHost.replace(/^www\./, ""));

  let canonicalHost: DomainHostVariantAnalysis["canonicalHost"] = "unknown";
  if (isWww && hostsMatch) canonicalHost = "www";
  else if (!isWww && hostsMatch) canonicalHost = "apex";
  else if (alternateStatus != null && !hostsMatch) canonicalHost = "mixed";

  let note: string | null = null;
  if (alternateStatus != null && !hostsMatch) {
    note = `La variante ${isWww ? "sin www" : "con www"} responde en host distinto (${altHost})`;
  } else if (alternateStatus != null && alternateStatus >= 400) {
    note = `Variante alternativa respondió HTTP ${alternateStatus}`;
  }

  return {
    primaryUrl,
    alternateUrl,
    alternateStatus,
    alternateFinalUrl,
    canonicalHost,
    hostsMatch,
    note,
  };
};

export const analyzeDomainInfra = async (
  url: string,
  signal: AbortSignal,
): Promise<DomainInfraAnalysis> => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  const [dns, emailAuth, ssl, hostVariant] = await Promise.all([
    fetchDns(hostname, signal),
    fetchEmailAuth(hostname, signal),
    fetchSsl(hostname, signal),
    probeHostVariant(url, signal),
  ]);

  return {
    hostname,
    dns,
    emailAuth,
    ssl,
    hostVariant,
  };
};
