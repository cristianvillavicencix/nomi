export const DEFAULT_SHARE_SITE_NAME = "Latino Business Support";
export const DEFAULT_SHARE_TITLE = "Latino Business Support";
export const DEFAULT_SHARE_DESCRIPTION =
  "Booking, forms, proposals, invoices, and client updates from Latino Business Support.";
export const DEFAULT_SHARE_IMAGE_PATH = "/logos/latino-business-support.jpg";
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
  title: env.VITE_OG_TITLE?.trim() || env.VITE_OG_SITE_NAME?.trim() || DEFAULT_SHARE_TITLE,
  description:
    env.VITE_OG_DESCRIPTION?.trim() || DEFAULT_SHARE_DESCRIPTION,
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
    imageUrl: toAbsoluteShareUrl(origin, env.imagePath || DEFAULT_SHARE_IMAGE_PATH),
    url: pageUrl,
  };
};

type ShareRouteRule = {
  test: (pathname: string) => boolean;
  title: string;
  description: string;
};

const SHARE_ROUTE_RULES: ShareRouteRule[] = [
  {
    test: (pathname) => /^\/b(\/|$)/.test(pathname) || /^\/book(\/|$)/.test(pathname),
    title: "Book an appointment",
    description: "Choose a service and schedule your visit with Latino Business Support.",
  },
  {
    test: (pathname) => /^\/forms(\/|$)/.test(pathname) || /^\/f(\/|$)/.test(pathname),
    title: "Complete your form",
    description: "Secure form from Latino Business Support.",
  },
  {
    test: (pathname) =>
      /^\/proposal(\/|$)/.test(pathname) || /^\/pr(\/|$)/.test(pathname),
    title: "View your proposal",
    description: "Review your proposal from Latino Business Support.",
  },
  {
    test: (pathname) =>
      /^\/invoice(\/|$)/.test(pathname) || /^\/iv(\/|$)/.test(pathname),
    title: "Pay your invoice",
    description: "View and pay your invoice from Latino Business Support.",
  },
  {
    test: (pathname) => /^\/portal(\/|$)/.test(pathname) || /^\/p(\/|$)/.test(pathname),
    title: "Client portal",
    description: "Access your projects and documents from Latino Business Support.",
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

  return {
    ...base,
    title: `${rule.title} · ${base.siteName}`,
    description: rule.description,
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
    ua.includes("preview") ||
    ua.includes("googlebot") ||
    ua.includes("bingbot") ||
    ua.includes("applebot")
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

const META_TAGS: Array<{
  selector: string;
  attr: "content";
  key: keyof Pick<PublicShareMeta, "title" | "description" | "siteName" | "imageUrl" | "url">;
}> = [
  { selector: 'meta[name="description"]', attr: "content", key: "description" },
  { selector: 'meta[property="og:site_name"]', attr: "content", key: "siteName" },
  { selector: 'meta[property="og:title"]', attr: "content", key: "title" },
  { selector: 'meta[property="og:description"]', attr: "content", key: "description" },
  { selector: 'meta[property="og:image"]', attr: "content", key: "imageUrl" },
  { selector: 'meta[property="og:url"]', attr: "content", key: "url" },
  { selector: 'meta[name="twitter:title"]', attr: "content", key: "title" },
  { selector: 'meta[name="twitter:description"]', attr: "content", key: "description" },
  { selector: 'meta[name="twitter:image"]', attr: "content", key: "imageUrl" },
];

const ensureMetaTag = (
  attribute: "name" | "property",
  value: string,
) => {
  const selector = `meta[${attribute}="${value}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  return element;
};

export const applyPublicShareMeta = (meta: PublicShareMeta) => {
  if (typeof document === "undefined") return;

  document.title = meta.title;

  ensureMetaTag("property", "og:type").content = "website";
  ensureMetaTag("name", "twitter:card").content = "summary_large_image";

  for (const tag of META_TAGS) {
    const node = document.querySelector(tag.selector) as HTMLMetaElement | null;
    if (node) {
      node.content = meta[tag.key];
      continue;
    }

    if (tag.selector.includes('property="og:')) {
      const property = tag.selector.match(/property="([^"]+)"/)?.[1];
      if (property) ensureMetaTag("property", property).content = meta[tag.key];
      continue;
    }

    const name = tag.selector.match(/name="([^"]+)"/)?.[1];
    if (name) ensureMetaTag("name", name).content = meta[tag.key];
  }
};
