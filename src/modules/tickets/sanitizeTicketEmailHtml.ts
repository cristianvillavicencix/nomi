import DOMPurify from "dompurify";

let emailHtmlHookInstalled = false;
let preserveColorsInHook = false;
let preserveLayoutInHook = false;

/** Absolute positioning / floats that often break the ticket chrome. */
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

const COLOR_STYLE_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
]);

const cleanInlineStyle = (
  raw: string,
  options: { stripColors: boolean; stripLayout: boolean },
) =>
  raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const prop = chunk.split(":")[0]?.trim().toLowerCase();
      if (!prop) return false;
      if (options.stripLayout && LAYOUT_BREAKING_STYLE_PROPS.has(prop)) {
        return false;
      }
      if (options.stripColors && COLOR_STYLE_PROPS.has(prop)) return false;
      if (prop === "margin" && /-\d/.test(chunk)) return false;
      return true;
    })
    .join("; ");

const normalizeAttachmentUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const attachmentUrlSet = (urls: string[]) =>
  new Set(urls.filter(Boolean).map(normalizeAttachmentUrl));

const stripDuplicateAttachmentNodes = (
  root: ParentNode,
  knownUrls: Set<string>,
  knownFilenames: Set<string>,
) => {
  root.querySelectorAll("img, a, object, embed, iframe").forEach((node) => {
    const href =
      node instanceof HTMLAnchorElement
        ? node.href
        : node instanceof HTMLImageElement
          ? node.src
          : (node.getAttribute("src") ?? node.getAttribute("data") ?? "");

    if (href) {
      const normalized = normalizeAttachmentUrl(href);
      if (knownUrls.has(normalized)) {
        node.remove();
        return;
      }
    }

    const label = (node.textContent ?? node.getAttribute("title") ?? "")
      .trim()
      .toLowerCase();
    if (label && knownFilenames.has(label)) {
      node.remove();
      return;
    }

    const filenameAttr = node.getAttribute("download")?.trim().toLowerCase();
    if (filenameAttr && knownFilenames.has(filenameAttr)) {
      node.remove();
    }
  });
};

const installEmailSanitizeHooks = () => {
  if (emailHtmlHookInstalled) return;
  emailHtmlHookInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === "IMG") {
      const src = node.getAttribute("src")?.trim().toLowerCase() ?? "";
      if (src.startsWith("cid:")) {
        // Never leave live cid: in the DOM (unknown URL scheme). Soft placeholder.
        node.setAttribute(
          "src",
          "data:image/svg+xml," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="11" font-family="sans-serif">Image</text></svg>`,
            ),
        );
        node.setAttribute("alt", "Inline image unavailable");
        node.setAttribute("data-cid-unresolved", "true");
        return;
      }
      if (preserveLayoutInHook) {
        node.style.setProperty("max-width", "100%", "important");
        if (!node.getAttribute("width") && !node.style.width) {
          node.style.setProperty("height", "auto", "important");
        }
      } else {
        node.removeAttribute("width");
        node.removeAttribute("height");
        node.style.setProperty("max-width", "100%", "important");
        node.style.setProperty("max-height", "420px", "important");
        node.style.setProperty("height", "auto", "important");
        node.style.setProperty("width", "auto", "important");
        node.style.setProperty("object-fit", "contain", "important");
      }
    }

    if (node.tagName === "TABLE") {
      node.style.setProperty("max-width", "100%", "important");
      node.removeAttribute("width");
    }

    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }

    if (!preserveColorsInHook) {
      node.removeAttribute("bgcolor");
      node.removeAttribute("color");
    }

    if (node.hasAttribute("style")) {
      const cleaned = cleanInlineStyle(node.getAttribute("style") ?? "", {
        stripColors: !preserveColorsInHook,
        stripLayout: !preserveLayoutInHook,
      });
      if (cleaned) {
        node.setAttribute("style", cleaned);
      } else {
        node.removeAttribute("style");
      }
    }

    if (!preserveLayoutInHook) {
      node.style.position = "static";
      node.style.float = "none";
      node.style.zIndex = "auto";
    }
  });
};

const runSanitize = (
  html: string,
  options?: {
    stripHrefs?: string[];
    attachmentSrcs?: string[];
    attachmentTitles?: string[];
    mode?: "safe" | "original";
  },
) => {
  const mode = options?.mode ?? "safe";
  preserveColorsInHook = mode === "original";
  preserveLayoutInHook = mode === "original";
  installEmailSanitizeHooks();

  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: [
      "target",
      "style",
      "align",
      "valign",
      "width",
      "height",
      "bgcolor",
    ],
    FORBID_TAGS: ["form", "script", "iframe", "object", "embed"],
  });

  if (typeof document === "undefined") {
    return sanitized;
  }

  const stripHrefs = [
    ...(options?.stripHrefs ?? []),
    ...(options?.attachmentSrcs ?? []),
  ];
  const attachmentTitles = options?.attachmentTitles ?? [];
  if (!stripHrefs.length && !attachmentTitles.length) {
    return sanitized;
  }

  const container = document.createElement("div");
  container.innerHTML = sanitized;
  stripDuplicateAttachmentNodes(
    container,
    attachmentUrlSet(stripHrefs),
    new Set(
      attachmentTitles
        .map((title) => title.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return container.innerHTML;
};

export const sanitizeTicketEmailHtml = (
  html: string,
  options?: {
    stripHrefs?: string[];
    attachmentSrcs?: string[];
    attachmentTitles?: string[];
  },
) => runSanitize(html, { ...options, mode: "safe" });

/** Minimal sanitization for "view original" — keeps marketing email layout. */
export const sanitizeTicketEmailHtmlOriginal = (
  html: string,
  options?: {
    stripHrefs?: string[];
    attachmentSrcs?: string[];
    attachmentTitles?: string[];
  },
) => runSanitize(html, { ...options, mode: "original" });
