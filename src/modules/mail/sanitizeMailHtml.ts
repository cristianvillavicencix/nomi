/**
 * Sanitize synced HTML email bodies for the Mail reader.
 * Keeps marketing layout (inline colors/styles) while stripping scripts,
 * cid: images, and unsafe document chrome.
 */
import DOMPurify from "dompurify";
import {
  isAllowedEmailCssImport,
  isAllowedEmailStylesheet,
} from "./mailRenderAllowlist";

let mailSanitizeHookInstalled = false;

/** Only strip inline props that are unsafe — not table/button layout. */
const UNSAFE_INLINE_STYLE_PROPS = new Set(["behavior"]);

const cleanInlineStyle = (raw: string) =>
  raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const prop = chunk.split(":")[0]?.trim().toLowerCase();
      const value = chunk.split(":").slice(1).join(":").trim().toLowerCase();
      if (!prop) return false;
      if (UNSAFE_INLINE_STYLE_PROPS.has(prop)) return false;
      if (prop === "margin" && /-\d/.test(chunk)) return false;
      if (/javascript\s*:/i.test(chunk)) return false;
      if (/expression\s*\(/i.test(chunk)) return false;
      return true;
    })
    .join("; ");

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

let bodyOpenTagCount = 0;

const stripRootDocumentChrome = (html: string): string => {
  bodyOpenTagCount = 0;
  return html
    .replace(/<\/?html(?:\s[^>]*)?>/gi, "")
    .replace(/<\/?head(?:\s[^>]*)?>/gi, "")
    .replace(/<body([^>]*)>/gi, (_match, attrs: string) => {
      bodyOpenTagCount += 1;
      if (bodyOpenTagCount === 1) {
        return `<div class="mail-body-root"${String(attrs)}>`;
      }
      return `<div class="mail-nested-body"${String(attrs)}>`;
    })
    .replace(/<\/body>/gi, "</div>");
};

const stripCidReferences = (html: string): string =>
  html
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']cid:[^"']+["'][^>]*>/gi, "")
    .replace(/\bsrc\s*=\s*(["'])cid:[^"']+\1/gi, "src=$1$1")
    .replace(/url\((["']?)cid:[^)"']+\1\)/gi, "none");

/** Pull `<style>` and safe `<link rel="stylesheet">` for iframe head. */
export function extractEmailHeadAssets(html: string): {
  htmlWithoutHeadAssets: string;
  emailStyles: string;
  headLinks: string;
} {
  let emailStyles = "";
  let headLinks = "";

  let withoutStyles = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => {
      emailStyles += `${css}\n`;
      return "";
    },
  );

  withoutStyles = withoutStyles.replace(
    /<link\b[^>]*\srel\s*=\s*["']?stylesheet["']?[^>]*>/gi,
    (tag) => {
      const hrefMatch = tag.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "").trim();
      if (href && isAllowedEmailStylesheet(href)) {
        headLinks += `<link rel="stylesheet" href="${escapeHtmlAttr(href)}" />`;
      }
      return "";
    },
  );

  return {
    htmlWithoutHeadAssets: withoutStyles,
    emailStyles: sanitizeEmailCss(emailStyles),
    headLinks,
  };
}

export function sanitizeEmailCss(css: string): string {
  let out = css
    .replace(/expression\s*\(/gi, "blocked(")
    .replace(/javascript\s*:/gi, "")
    .replace(/behavior\s*:\s*url\b[^;]+;?/gi, "");

  out = stripNewsletterCollapseMediaBlocks(out);
  out += "\n.mobile_only{display:none!important;}\n";

  out = out.replace(/@import\s+url\s*\(\s*([^)]+)\s*\)\s*;?/gi, (match, inner: string) => {
    const urlMatch = String(inner).match(/(https:\/\/[^'"\s)]+(?:;[^'"\s)]*)*)/i);
    const url = urlMatch?.[1] ?? "";
    if (url && isAllowedEmailCssImport(url)) return match;
    return "";
  });

  return out;
}

/** Remove @media blocks that hide `.desktop_only` (broken nested `{` regex-safe). */
function stripNewsletterCollapseMediaBlocks(css: string): string {
  let out = "";
  let i = 0;
  const lower = css.toLowerCase();

  while (i < css.length) {
    const mediaIdx = lower.indexOf("@media", i);
    if (mediaIdx === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, mediaIdx);
    const braceStart = css.indexOf("{", mediaIdx);
    if (braceStart === -1) {
      out += css.slice(mediaIdx);
      break;
    }
    let depth = 0;
    let j = braceStart;
    for (; j < css.length; j++) {
      const ch = css[j];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    const block = css.slice(mediaIdx, j);
    const drop =
      /\.desktop_only/.test(block) && /display\s*:\s*none/.test(block);
    if (!drop) out += block;
    i = j;
  }

  return out;
}

export type SanitizedMailHtml = {
  body: string;
  emailStyles: string;
  headLinks: string;
};

export function sanitizeMailHtmlParts(raw: string): SanitizedMailHtml {
  installMailSanitizeHooks();
  const { htmlWithoutHeadAssets, emailStyles, headLinks } =
    extractEmailHeadAssets(raw);
  const prepared = stripRootDocumentChrome(
    stripCidReferences(htmlWithoutHeadAssets),
  );
  const body = DOMPurify.sanitize(prepared, {
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
      "class",
    ],
    ADD_TAGS: ["style"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    ALLOW_DATA_ATTR: false,
  });
  return { body, emailStyles, headLinks };
}

export function sanitizeMailHtml(html: string): string {
  return sanitizeMailHtmlParts(html).body;
}

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
      // Prevent newsletter logos from stretching when senders set fixed height.
      node.style.setProperty("max-width", "100%", "important");
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("object-fit", "contain");
      const widthAttr = Number.parseInt(node.getAttribute("width") ?? "", 10);
      if (Number.isFinite(widthAttr) && widthAttr > 680) {
        node.setAttribute("width", "680");
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

    const pos = node.style.position?.toLowerCase();
    if (pos === "fixed" || pos === "sticky") {
      node.style.position = "relative";
    }
  });
};
