/**
 * Sanitize synced HTML email bodies for safe rendering in the Mail pane.
 * Allows inline styles so messages look closer to the provider; still strips
 * scripts, iframes, forms, and event-handler attributes.
 * Neutralizes root html/body backgrounds so marketing mail cannot paint the
 * whole CRM reader — nested content keeps its own styles inside the canvas.
 */
import DOMPurify from "dompurify";

const stripRootDocumentChrome = (html: string): string =>
  html
    .replace(/<\/?(?:html|head)(?:\s[^>]*)?>/gi, "")
    .replace(/<body([^>]*)>/gi, (_match, attrs: string) => {
      const withoutBg = String(attrs)
        .replace(/\sbgcolor\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\sbackground\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, d1, d2) => {
          const style = String(d1 ?? d2 ?? "")
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .filter(
              (part) =>
                !/^(background|background-color|background-image)\s*:/i.test(
                  part,
                ),
            )
            .join("; ");
          return style ? ` style="${style}"` : "";
        });
      return `<div class="mail-body-root"${withoutBg}>`;
    })
    .replace(/<\/body>/gi, "</div>");

export function sanitizeMailHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
  return stripRootDocumentChrome(clean);
}
