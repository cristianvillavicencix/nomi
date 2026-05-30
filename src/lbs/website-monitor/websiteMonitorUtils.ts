import type { WebsiteMonitorStatus } from "@/lbs/website-monitor/types";

export const WEBSITE_STATUS_LABELS: Record<WebsiteMonitorStatus, string> = {
  up: "UP",
  slow: "LENTO",
  down: "CAÍDO",
  unknown: "SIN DATOS",
};

export const WEBSITE_STATUS_COLORS: Record<WebsiteMonitorStatus, string> = {
  up: "#22c55e",
  slow: "#eab308",
  down: "#ef4444",
  unknown: "#94a3b8",
};

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  status: "Estado",
  hosting: "Hosting",
  tech_stack: "Stack tecnológico",
  ssl: "SSL",
  page_title: "Título",
  dns: "DNS",
  response_time: "Tiempo de respuesta",
};

export const extractDomainFromUrl = (url?: string | null): string | null => {
  const value = url?.trim();
  if (!value) return null;
  const stripped = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim();
  return stripped || null;
};

export const getWebsiteFaviconSrc = (url?: string | null): string | undefined => {
  const domain = extractDomainFromUrl(url);
  if (!domain) return undefined;
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
};

export const formatResponseMs = (value?: number | null) =>
  value == null ? "—" : `${value} ms`;

export const formatUptimePct = (value?: number | null) =>
  value == null ? "—" : `${value}%`;

export const formatCheckedAt = (value?: string | null) => {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export const isMarketingOpportunity = (status?: WebsiteMonitorStatus | null) =>
  status === "down" || status === "slow";

export const isSslExpiringSoon = (days?: number | null) =>
  days != null && days <= 30;

export const uniqueSorted = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter(Boolean) as string[])].sort();
