const DEFAULT_REFERRAL_TEMPLATE =
  "https://www.hostinger.com/domain?domain={domain}&REFERRALCODE={code}";

export const getHostingerDomainCheckerUrl = (domain: string) =>
  `https://www.hostinger.com/domain?domain=${encodeURIComponent(domain)}`;

export const getHostingerBuyInHpanelUrl = (domain: string) =>
  `https://www.hostinger.com/domain/domain-checker?domain=${encodeURIComponent(domain)}`;

export const buildHostingerReferralPurchaseUrl = (
  domain: string,
  params?: {
    referralCode?: string | null;
    referralLinkTemplate?: string | null;
  },
) => {
  const code = params?.referralCode?.trim() ?? "";
  const template = params?.referralLinkTemplate?.trim() || DEFAULT_REFERRAL_TEMPLATE;

  if (!code) {
    return getHostingerDomainCheckerUrl(domain);
  }

  return template
    .replaceAll("{domain}", encodeURIComponent(domain))
    .replaceAll("{code}", encodeURIComponent(code));
};

export const formatHostingerPrice = (
  cents?: number | null,
  currency = "USD",
) => {
  if (cents == null || Number.isNaN(cents)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};
