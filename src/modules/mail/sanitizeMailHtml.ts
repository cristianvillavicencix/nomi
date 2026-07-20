/**
 * Sanitize synced HTML email bodies for safe rendering in the Mail pane.
 * Allows inline styles so messages look closer to the provider; still strips
 * scripts, iframes, forms, and event-handler attributes.
 */
import DOMPurify from "dompurify";

export function sanitizeMailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
}
