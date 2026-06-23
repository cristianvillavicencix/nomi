import {
  buildSharePreviewHtml,
  isSocialPreviewCrawler,
  readShareMetaEnv,
  resolvePublicShareMeta,
} from "./src/lib/publicShareMeta.ts";

const shareEnv = readShareMetaEnv({
  VITE_OG_SITE_NAME: process.env.VITE_OG_SITE_NAME,
  VITE_OG_TITLE: process.env.VITE_OG_TITLE,
  VITE_OG_DESCRIPTION: process.env.VITE_OG_DESCRIPTION,
  VITE_OG_IMAGE_PATH: process.env.VITE_OG_IMAGE_PATH,
  VITE_PUBLIC_APP_URL: process.env.VITE_PUBLIC_APP_URL,
  VITE_SITE_URL: process.env.VITE_SITE_URL,
});

const PUBLIC_SHARE_PREFIXES = [
  "/book/",
  "/b/",
  "/forms/",
  "/f/",
  "/proposal/",
  "/pr/",
  "/invoice/",
  "/iv/",
  "/portal/",
  "/p/",
];

const isPublicSharePath = (pathname: string) =>
  PUBLIC_SHARE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export default function middleware(request: Request) {
  const url = new URL(request.url);
  if (!isPublicSharePath(url.pathname)) return;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!isSocialPreviewCrawler(userAgent)) return;

  const meta = resolvePublicShareMeta(url.pathname, url.href, shareEnv);
  return new Response(buildSharePreviewHtml(meta), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export const config = {
  matcher: [
    "/book/:path*",
    "/b/:path*",
    "/forms/:path*",
    "/f/:path*",
    "/proposal/:path*",
    "/pr/:path*",
    "/invoice/:path*",
    "/iv/:path*",
    "/portal/:path*",
    "/p/:path*",
  ],
};
