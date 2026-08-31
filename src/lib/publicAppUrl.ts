import {
  buildSubscriptionAgreementSharePath,
  buildSubscriptionSetupSharePath,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";

/** Public CRM origin for links sent to clients (SMS, email). */
export const DEFAULT_PUBLIC_APP_URL = "https://www.nomicrm.com";

const LOCAL_APP_HOST_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export const resolvePublicAppBaseUrl = (): string => {
  const envUrl =
    String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim() ||
    String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (!LOCAL_APP_HOST_PATTERN.test(origin)) {
      return origin;
    }
  }
  return DEFAULT_PUBLIC_APP_URL;
};

const isAgreementShare = (params: {
  setup_share_url?: string | null;
  enrollment_mode?: string | null;
}) =>
  params.enrollment_mode === "agreement" ||
  Boolean(params.setup_share_url?.includes("/sub-agree/"));

export const resolveSubscriptionSetupShareUrl = (params: {
  setup_share_url?: string | null;
  setup_short_code?: string | null;
  enrollment_mode?: string | null;
}): string => {
  const base = resolvePublicAppBaseUrl();
  const shortCode = params.setup_short_code?.trim();
  const agreement = isAgreementShare(params);
  const pathFor = (code: string) =>
    agreement
      ? buildSubscriptionAgreementSharePath(code)
      : buildSubscriptionSetupSharePath(code);

  if (shortCode) {
    return `${base}${pathFor(shortCode)}`;
  }

  const stored = params.setup_share_url?.trim();
  if (stored) {
    const shortCodeFromStored =
      stored.match(/\/sub-agree\/([^/?#]+)/i)?.[1] ||
      stored.match(/\/sub\/([^/?#]+)/i)?.[1];
    if (shortCodeFromStored && LOCAL_APP_HOST_PATTERN.test(stored)) {
      const storedIsAgreement = stored.includes("/sub-agree/");
      return `${base}${
        storedIsAgreement || agreement
          ? buildSubscriptionAgreementSharePath(shortCodeFromStored)
          : buildSubscriptionSetupSharePath(shortCodeFromStored)
      }`;
    }
    if (!LOCAL_APP_HOST_PATTERN.test(stored)) {
      return stored;
    }
  }

  return agreement ? `${base}/sub-agree/…` : `${base}/sub/…`;
};
