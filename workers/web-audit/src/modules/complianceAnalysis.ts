import type { CheerioAPI } from "cheerio";

export type ComplianceSignals = {
  hasPrivacyLink: boolean;
  privacyUrls: string[];
  hasCookieBanner: boolean;
  cookieBannerSignals: string[];
  hasTelLink: boolean;
  telLinks: string[];
  napInSchema: boolean;
  schemaPhone: string | null;
  schemaAddress: string | null;
};

const PRIVACY_PATTERN =
  /privacy|privacidad|pol[ií]tica de privacidad|data protection|aviso de privacidad/i;

const COOKIE_BANNER_SELECTORS = [
  "#cookie",
  "#cookies",
  "#cookie-banner",
  "#cookie-notice",
  "#cookie-consent",
  "#CybotCookiebotDialog",
  ".cookie-banner",
  ".cookie-notice",
  ".cookie-consent",
  ".cc-window",
  "[class*='cookie']",
  "[id*='cookie']",
  "[aria-label*='cookie' i]",
];

const extractSchemaPhone = (html: string) => {
  const phoneMatch = html.match(
    /"telephone"\s*:\s*"([^"]+)"/i,
  );
  return phoneMatch?.[1]?.trim() ?? null;
};

const extractSchemaAddress = (html: string) => {
  const street = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1];
  const locality = html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1];
  const region = html.match(/"addressRegion"\s*:\s*"([^"]+)"/i)?.[1];
  const parts = [street, locality, region].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
};

export const analyzeComplianceSignals = (
  $: CheerioAPI,
  origin: string,
  html: string,
): ComplianceSignals => {
  const privacyUrls = new Set<string>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href")?.trim();
    const text = $(el).text().trim();
    if (!href) return;
    if (!PRIVACY_PATTERN.test(`${text} ${href}`)) return;
    try {
      privacyUrls.add(new URL(href, origin).href);
    } catch {
      privacyUrls.add(href);
    }
  });

  const cookieBannerSignals: string[] = [];
  for (const selector of COOKIE_BANNER_SELECTORS) {
    const match = $(selector).first();
    if (match.length && match.text().trim().length > 0) {
      cookieBannerSignals.push(selector);
      if (cookieBannerSignals.length >= 3) break;
    }
  }
  if (/cookiebot|onetrust|gdpr|consent mode|cookie consent/i.test(html)) {
    cookieBannerSignals.push("script-keyword");
  }

  const telLinks = new Set<string>();
  $('a[href^="tel:"]').each((_i, el) => {
    const href = $(el).attr("href")?.trim();
    if (href) telLinks.add(href.replace(/^tel:/i, "").trim());
  });

  const schemaPhone = extractSchemaPhone(html);
  const schemaAddress = extractSchemaAddress(html);
  const napInSchema = Boolean(schemaPhone || schemaAddress);

  return {
    hasPrivacyLink: privacyUrls.size > 0,
    privacyUrls: [...privacyUrls].slice(0, 5),
    hasCookieBanner: cookieBannerSignals.length > 0,
    cookieBannerSignals: [...new Set(cookieBannerSignals)].slice(0, 5),
    hasTelLink: telLinks.size > 0,
    telLinks: [...telLinks].slice(0, 5),
    napInSchema,
    schemaPhone,
    schemaAddress,
  };
};
