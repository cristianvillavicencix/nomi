/**
 * Open Graph / social share meta for public CRM links.
 *
 * iMessage and similar crawlers cache previews aggressively — after changing
 * og:image or titles, test with a new short URL or a cache-bust query.
 * Middleware serves this HTML to crawlers; the SPA uses the same resolver.
 */

export const DEFAULT_SHARE_SITE_NAME = "Sigma by Latino Business Support";
export const DEFAULT_SHARE_TITLE = "Sigma by Latino Business Support";
export const DEFAULT_SHARE_DESCRIPTION =
  "Booking, forms, proposals, invoices, and client updates from Sigma by Latino Business Support.";
export const DEFAULT_SHARE_IMAGE_PATH = "/og/sigma-default.jpg";
export const DEFAULT_PUBLIC_APP_ORIGIN = "https://www.nomicrm.com";

export type PublicShareMeta = {
  title: string;
  description: string;
  siteName: string;
  imageUrl: string;
  url: string;
};

export type ShareMetaEnv = {
  siteName?: string;
  title?: string;
  description?: string;
  imagePath?: string;
  publicAppOrigin?: string;
};

export const readShareMetaEnv = (
  env: Record<string, string | undefined> = {},
): ShareMetaEnv => ({
  siteName: env.VITE_OG_SITE_NAME?.trim() || DEFAULT_SHARE_SITE_NAME,
  title:
    env.VITE_OG_TITLE?.trim() ||
    env.VITE_OG_SITE_NAME?.trim() ||
    DEFAULT_SHARE_TITLE,
  description: env.VITE_OG_DESCRIPTION?.trim() || DEFAULT_SHARE_DESCRIPTION,
  imagePath: env.VITE_OG_IMAGE_PATH?.trim() || DEFAULT_SHARE_IMAGE_PATH,
  publicAppOrigin:
    env.VITE_PUBLIC_APP_URL?.trim() ||
    env.VITE_SITE_URL?.trim() ||
    DEFAULT_PUBLIC_APP_ORIGIN,
});

export const toAbsoluteShareUrl = (origin: string, path: string) => {
  const base = origin.replace(/\/$/, "");
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

export const buildDefaultShareMeta = (
  env: ShareMetaEnv = {},
  pageUrl = DEFAULT_PUBLIC_APP_ORIGIN,
): PublicShareMeta => {
  const siteName = env.siteName || DEFAULT_SHARE_SITE_NAME;
  const origin = (env.publicAppOrigin || DEFAULT_PUBLIC_APP_ORIGIN).replace(
    /\/$/,
    "",
  );
  return {
    title: env.title || siteName,
    description: env.description || DEFAULT_SHARE_DESCRIPTION,
    siteName,
    imageUrl: toAbsoluteShareUrl(
      origin,
      env.imagePath || DEFAULT_SHARE_IMAGE_PATH,
    ),
    url: pageUrl,
  };
};

type ShareRouteRule = {
  test: (pathname: string) => boolean;
  title: string;
  description: string;
  imagePath: string;
};

const SHARE_ROUTE_RULES: ShareRouteRule[] = [
  {
    test: (pathname) =>
      /^\/c(\/|$)/.test(pathname) || /^\/cal(\/|$)/.test(pathname),
    title: "Add to calendar · video call",
    description:
      "Save this video call to your calendar and join with one tap — Sigma by Latino Business Support.",
    imagePath: "/og/sigma-meeting.jpg",
  },
  {
    test: (pathname) =>
      /^\/b(\/|$)/.test(pathname) || /^\/book(\/|$)/.test(pathname),
    title: "Book an appointment",
    description:
      "Choose a time and schedule your visit with Sigma by Latino Business Support.",
    imagePath: "/og/sigma-booking.jpg",
  },
  {
    test: (pathname) =>
      /^\/forms(\/|$)/.test(pathname) || /^\/f(\/|$)/.test(pathname),
    title: "Complete your form",
    description:
      "Secure form from Sigma by Latino Business Support — fill it out in a few minutes.",
    imagePath: "/og/sigma-form.jpg",
  },
  {
    test: (pathname) =>
      /^\/proposal(\/|$)/.test(pathname) || /^\/pr(\/|$)/.test(pathname),
    title: "Review your proposal",
    description:
      "Open your proposal from Sigma by Latino Business Support and review the details.",
    imagePath: "/og/sigma-proposal.jpg",
  },
  {
    test: (pathname) =>
      /^\/invoice(\/|$)/.test(pathname) ||
      /^\/iv(\/|$)/.test(pathname) ||
      /^\/portal\/invoice(\/|$)/.test(pathname),
    title: "View & pay your invoice",
    description:
      "View your invoice and pay securely online with Sigma by Latino Business Support.",
    imagePath: "/og/sigma-invoice.jpg",
  },
  {
    test: (pathname) =>
      /^\/portal(\/|$)/.test(pathname) || /^\/p(\/|$)/.test(pathname),
    title: "Client portal",
    description:
      "Access your projects and documents from Sigma by Latino Business Support.",
    imagePath: "/og/sigma-portal.jpg",
  },
];

export const resolvePublicShareMeta = (
  pathname: string,
  pageUrl: string,
  env: ShareMetaEnv = {},
): PublicShareMeta => {
  const base = buildDefaultShareMeta(env, pageUrl);
  const rule = SHARE_ROUTE_RULES.find((entry) => entry.test(pathname));
  if (!rule) return base;

  const origin = (env.publicAppOrigin || DEFAULT_PUBLIC_APP_ORIGIN).replace(
    /\/$/,
    "",
  );

  return {
    ...base,
    title: `${rule.title} · ${base.siteName}`,
    description: rule.description,
    imageUrl: toAbsoluteShareUrl(origin, rule.imagePath),
    url: pageUrl,
  };
};

export const isSocialPreviewCrawler = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||
    ua.includes("facebot") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("slackbot") ||
    ua.includes("discordbot") ||
    ua.includes("telegrambot") ||
    ua.includes("whatsapp") ||
    ua.includes("pinterest") ||
    ua.includes("embedly") ||
    ua.includes("skypeuripreview") ||
    ua.includes("preview") ||
    ua.includes("googlebot") ||
    ua.includes("bingbot") ||
    ua.includes("applebot") ||
    // Apple Messages / Link Presentation often includes these tokens
    ua.includes("imessage") ||
    ua.includes("messages") && ua.includes("apple")
  );
};

export const buildSharePreviewHtml = (meta: PublicShareMeta) => {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(meta.title)}</title>
    <meta name="description" content="${escape(meta.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escape(meta.siteName)}" />
    <meta property="og:title" content="${escape(meta.title)}" />
    <meta property="og:description" content="${escape(meta.description)}" />
    <meta property="og:image" content="${escape(meta.imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escape(meta.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(meta.title)}" />
    <meta name="twitter:description" content="${escape(meta.description)}" />
    <meta name="twitter:image" content="${escape(meta.imageUrl)}" />
    <link rel="canonical" href="${escape(meta.url)}" />
  </head>
  <body>
    <p>${escape(meta.title)}</p>
  </body>
</html>`;
};
