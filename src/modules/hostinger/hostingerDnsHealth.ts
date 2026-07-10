import type { HostingerDnsRecord, HostingerDomain } from "@/modules/hostinger/types";

export type HostingerDnsHealth = {
  has_a: boolean;
  has_mx: boolean;
  ns_hostinger: boolean;
  checked_at?: string;
};

const hasEnabledRecord = (
  records: HostingerDnsRecord[],
  type: string,
) =>
  records.some((row) => {
    if (row.type?.toUpperCase() !== type) return false;
    return row.records?.some(
      (entry) => Boolean(entry.content?.trim()) && entry.is_disabled !== true,
    );
  });

const isHostingerNameserver = (value: string) =>
  /hostinger|dns-parking/i.test(value.trim());

export const analyzeHostingerDnsHealth = (
  records: HostingerDnsRecord[],
): HostingerDnsHealth => {
  const nsRecords = records
    .filter((row) => row.type?.toUpperCase() === "NS")
    .flatMap((row) => row.records ?? [])
    .map((entry) => entry.content?.trim() ?? "")
    .filter(Boolean);

  return {
    has_a: hasEnabledRecord(records, "A"),
    has_mx: hasEnabledRecord(records, "MX"),
    ns_hostinger:
      nsRecords.length > 0
        ? nsRecords.every(isHostingerNameserver)
        : false,
    checked_at: new Date().toISOString(),
  };
};

export const readDomainDnsHealth = (
  domain: HostingerDomain,
): HostingerDnsHealth | null => {
  const raw = domain.metadata?.dns_health;
  if (!raw || typeof raw !== "object") return null;
  const health = raw as HostingerDnsHealth;
  if (
    typeof health.has_a !== "boolean" ||
    typeof health.has_mx !== "boolean" ||
    typeof health.ns_hostinger !== "boolean"
  ) {
    return null;
  }
  return health;
};
