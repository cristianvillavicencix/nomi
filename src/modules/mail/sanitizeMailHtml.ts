/**
 * Sanitize synced HTML email bodies for the Mail reader.
 * Keeps marketing layout (inline colors/styles) while stripping scripts,
 * cid: images, root document chrome, and layout that escapes the canvas.
 */
import DOMPurify from "dompurify";

let mailSanitizeHookInstalled = false;

const LAYOUT_BREAKING_STYLE_PROPS = new Set([
  "position",
  "float",
  "z-index",
  "top",
  "left",
  "right",
  "bottom",
  "transform",
]);

const cleanInlineStyle = (raw: string) =>
  raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const prop = chunk.split(":")[0]?.trim().toLowerCase();
      if (!prop) return false;
      if (LAYOUT_BREAKING_STYLE_PROPS.has(prop)) return false;
      if (prop === "margin" && /-\d/.test(chunk)) return false;
      return true;
    })
    .join("; ");

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

const stripCidReferences = (html: string): string =>
  html
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']cid:[^"']+["'][^>]*>/gi, "")
    .replace(/\bsrc\s*=\s*(["'])cid:[^"']+\1/gi, "src=$1$1")
    .replace(/url\((["']?)cid:[^)"']+\1\)/gi, "none");

const installMailSanitizeHooks = () => {
  if (mailSanitizeHookInstalled) return;
  mailSanitizeHookInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === "IMG") {
      const src = node.getAttribute("src")?.trim().toLowerCase() ?? "";
      if (src.startsWith("cid:") || !src) {
        node.remove();
        return;
      }
      if (!node.getAttribute("style")?.includes("max-width")) {
        node.style.setProperty("max-width", "100%");
      }
      if (!node.style.height && !node.getAttribute("height")) {
        node.style.setProperty("height", "auto");
      }
    }

    if (node.tagName === "TABLE") {
      if (!node.getAttribute("style")?.includes("max-width")) {
        node.style.setProperty("max-width", "100%");
      }
    }

    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }

    if (node.hasAttribute("style")) {
      const cleaned = cleanInlineStyle(node.getAttribute("style") ?? "");
      if (cleaned) node.setAttribute("style", cleaned);
      else node.removeAttribute("style");
    }

    // Keep marketing layout but prevent escaping the reader canvas.
    if (LAYOUT_BREAKING_STYLE_PROPS.size) {
      const pos = node.style.position?.toLowerCase();
      if (pos === "fixed" || pos === "absolute" || pos === "sticky") {
        node.style.position = "relative";
      }
      if (node.style.float && node.style.float !== "none") {
        node.style.float = "none";
      }
    }
  });
};

export function sanitizeMailHtml(html: string): string {
  installMailSanitizeHooks();
  const prepared = stripRootDocumentChrome(stripCidReferences(html));
  return DOMPurify.sanitize(prepared, {
    ADD_ATTR: [
      "target",
      "style",
      "align",
      "valign",
      "width",
      "height",
      "bgcolor",
      "cellpadding",
      "cellspacing",
      "border",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
}
