/**
 * Sanitize synced HTML email bodies for safe rendering in the Mail pane.
 */
import DOMPurify from "dompurify";

export function sanitizeMailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
    ALLOW_DATA_ATTR: false,
  });
}
