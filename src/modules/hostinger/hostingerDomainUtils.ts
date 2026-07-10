import type {
  HostingerDomain,
  HostingerDomainFilter,
  HostingerOverviewStats,
} from "@/modules/hostinger/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const daysUntilExpiry = (expiresAt?: string | null) => {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return null;
  return Math.ceil((expires - Date.now()) / MS_PER_DAY);
};

export const formatExpiryLabel = (expiresAt?: string | null) => {
  const days = daysUntilExpiry(expiresAt);
  if (days == null) return "No expiry date";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days}d`;
};

export const isExpiredDomain = (domain: HostingerDomain) => {
  if (domain.status === "expired") return true;
  const days = daysUntilExpiry(domain.expires_at);
  return days != null && days < 0;
};

export const isExpiringWithinDays = (
  domain: HostingerDomain,
  withinDays: number,
) => {
  if (isExpiredDomain(domain)) return false;
  const days = daysUntilExpiry(domain.expires_at);
  return days != null && days >= 0 && days <= withinDays;
};

export const matchesHostingerDomainFilter = (
  domain: HostingerDomain,
  filter: HostingerDomainFilter,
) => {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return domain.status === "active" && !isExpiredDomain(domain);
    case "expired":
      return isExpiredDomain(domain) || domain.status === "expired";
    case "expiring_30":
      return isExpiringWithinDays(domain, 30);
    case "expiring_60":
      return isExpiringWithinDays(domain, 60);
    case "expiring_90":
      return isExpiringWithinDays(domain, 90);
    case "unlinked":
      return !domain.company_id;
    default:
      return true;
  }
};

export const computeHostingerOverviewStats = (
  domains: HostingerDomain[],
): HostingerOverviewStats => ({
  total: domains.length,
  active: domains.filter((d) => matchesHostingerDomainFilter(d, "active"))
    .length,
  expiring30: domains.filter((d) => matchesHostingerDomainFilter(d, "expiring_30"))
    .length,
  expiring60: domains.filter((d) => matchesHostingerDomainFilter(d, "expiring_60"))
    .length,
  expiring90: domains.filter((d) => matchesHostingerDomainFilter(d, "expiring_90"))
    .length,
  expired: domains.filter((d) => matchesHostingerDomainFilter(d, "expired"))
    .length,
  unlinked: domains.filter((d) => matchesHostingerDomainFilter(d, "unlinked"))
    .length,
});

export const formatHostingerStatus = (status: string) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
