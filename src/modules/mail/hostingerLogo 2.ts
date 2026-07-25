/** Hostinger brand mark (geometric H) — used in mail UI and transactional email rendering. */
export const HOSTINGER_BRAND_PURPLE = "#673DE6";

/** Icon-only mark (matches Hostinger transactional emails). */
export const HOSTINGER_LOGO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="7.002 8.287 148.203 175.426" fill="none" aria-hidden="true"><path d="m7.002 8.287 39.319 21.172v39.32h57.467l36.295 21.172h-133.081zm148.203 75.615v-54.443l-42.344-21.172v51.418zm0 99.811-39.319-21.172v-39.32h-57.467l-36.295-21.172h133.081zm-148.203-75.615v54.443l42.343 21.172v-51.418z" fill="${HOSTINGER_BRAND_PURPLE}"/></svg>`;

export const HOSTINGER_LOGO_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  HOSTINGER_LOGO_ICON_SVG,
)}`;

const HOSTINGER_LOGO_SRC =
  /(?:https?:)?\/\/[^"'\s>]*hostinger[^"'\s>]*(?:logo|brand|icon)[^"'\s>]*/i;

/** Swap remote Hostinger logo URLs for the embedded SVG (crisp + offline-safe). */
export function rewriteHostingerLogoImagesInHtml(html: string): string {
  if (!html.trim() || !/hostinger/i.test(html)) return html;

  return html.replace(
    /<img\b([^>]*?)>/gi,
    (tag, attrs: string) => {
      const srcMatch = attrs.match(
        /\bsrc\s*=\s*(["'])([^"']+)\1/i,
      );
      const src = srcMatch?.[2]?.trim() ?? "";
      const altMatch = attrs.match(/\balt\s*=\s*(["'])([^"']*)\1/i);
      const alt = altMatch?.[2]?.trim() ?? "";

      const isHostingerLogo =
        HOSTINGER_LOGO_SRC.test(src) ||
        (/hostinger/i.test(alt) && /logo|icon|brand/i.test(alt));

      if (!isHostingerLogo) return tag;

      const withoutSrc = attrs.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, "");
      return `<img src="${HOSTINGER_LOGO_DATA_URI}"${withoutSrc}>`;
    },
  );
}
