import type { PortalDelivery } from "@/modules/portal/portalTypes";

export type PortalHostingMeta = {
  provider?: string | null;
  panel_url?: string | null;
  managed_by?: "lbs" | "client" | string | null;
  location?: string | null;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

export const readPortalHostingMeta = (
  delivery?: PortalDelivery | null,
): PortalHostingMeta => {
  const domainInfo = readRecord(delivery?.domain_info);
  const hosting = readRecord(domainInfo?.hosting);
  if (!hosting) return {};

  return {
    provider:
      typeof hosting.provider === "string"
        ? hosting.provider.trim() || null
        : null,
    panel_url:
      typeof hosting.panel_url === "string"
        ? hosting.panel_url.trim() || null
        : null,
    managed_by:
      typeof hosting.managed_by === "string" ? hosting.managed_by : null,
    location:
      typeof hosting.location === "string"
        ? hosting.location.trim() || null
        : null,
  };
};

export const buildPortalHostingMetaPayload = (meta: PortalHostingMeta) => ({
  provider: meta.provider?.trim() || null,
  panel_url: meta.panel_url?.trim() || null,
  managed_by: meta.managed_by === "client" ? "client" : "lbs",
  location: meta.location?.trim() || null,
});
