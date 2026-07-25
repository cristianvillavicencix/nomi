import type { HostingerDnsRecord } from "./hostingerApi.ts";

export type HostingerDnsHealth = {
  has_a: boolean;
  has_mx: boolean;
  ns_hostinger: boolean;
  checked_at: string;
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
  const nsFromZone = records
    .filter((row) => row.type?.toUpperCase() === "NS")
    .flatMap((row) => row.records ?? [])
    .map((entry) => entry.content?.trim() ?? "")
    .filter(Boolean);

  const ns_hostinger = nsFromZone.length > 0
    ? nsFromZone.every(isHostingerNameserver)
    : false;

  return {
    has_a: hasEnabledRecord(records, "A"),
    has_mx: hasEnabledRecord(records, "MX"),
    ns_hostinger,
    checked_at: new Date().toISOString(),
  };
};
