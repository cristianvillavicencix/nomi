/**
 * HTTPS allowlist for external stylesheets in HTML email (fonts + ESP CDNs).
 * Images stay in HTML as-is (https); this only gates <link rel="stylesheet"> and @import.
 */

const EXACT_STYLESHEET_HOSTS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "www.gstatic.com",
  "ssl.gstatic.com",
  "use.typekit.net",
  "p.typekit.net",
  "fast.fonts.net",
  "hello.myfonts.net",
  "fonts.bunny.net",
  "fonts.cdnfonts.com",
  "chimpstatic.com",
  "gallery.mailchimp.com",
  "use.fontawesome.com",
  "kit.fontawesome.com",
  "ka-p.fontawesome.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "maxcdn.bootstrapcdn.com",
  "stackpath.bootstrapcdn.com",
  "usebootstrap.com",
  "app-rsrc.getbee.io",
]);

/** Hostname must end with one of these suffixes. */
const STYLESHEET_HOST_SUFFIXES = [
  ".googleusercontent.com",
  ".list-manage.com",
  ".createsend.com",
  ".campaign-archive.com",
  ".exacttarget.com",
  ".marketingcloudapis.com",
  ".r20.rs6.net",
  ".emltrk.com",
];

function normalizeStylesheetHref(href: string): string {
  const trimmed = href.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

function hostnameAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (EXACT_STYLESHEET_HOSTS.has(h)) return true;
  if (h.startsWith("click.email.")) return true;
  return STYLESHEET_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

/** Whether an external stylesheet URL may be injected into the mail iframe head. */
export function isAllowedEmailStylesheet(href: string): boolean {
  const normalized = normalizeStylesheetHref(href);
  if (!normalized) return false;
  if (!/^https:\/\//i.test(normalized)) return false;
  const hostMatch = normalized.match(/^https:\/\/([^/?#]+)/i);
  if (!hostMatch?.[1]) return false;
  return hostnameAllowed(hostMatch[1]);
}

/** Whether a CSS @import target is allowlisted (url(...) fragment). */
export function isAllowedEmailCssImport(importFragment: string): boolean {
  const fragment = importFragment.trim();
  const urlMatch = fragment.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  const raw = urlMatch?.[1] ?? fragment;
  if (/^data:/i.test(raw)) return false;
  return isAllowedEmailStylesheet(raw);
}

export function listBlockedStylesheetHrefs(html: string): string[] {
  const blocked: string[] = [];
  html.replace(
    /<link\b[^>]*\srel\s*=\s*["']?stylesheet["']?[^>]*>/gi,
    (tag) => {
      const hrefMatch = tag.match(
        /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i,
      );
      const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "").trim();
      if (href && !isAllowedEmailStylesheet(href)) {
        blocked.push(href);
      }
      return tag;
    },
  );
  return blocked;
}

/** For debug UI — human-readable allowlist summary. */
export const MAIL_STYLESHEET_ALLOWLIST_HINT =
  "Google Fonts, Typekit, Font Awesome, Mailchimp, jsDelivr, cdnjs, Bootstrap CDNs, Salesforce Marketing Cloud (*.exacttarget.com), …";
