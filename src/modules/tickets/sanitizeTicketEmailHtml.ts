import DOMPurify from "dompurify";

let emailHtmlHookInstalled = false;
let preserveColorsInHook = false;

/** Strip layout-breaking CSS; in safe mode also strip colors so dark mode stays readable. */
const BLOCKED_STYLE_PROPS = new Set([
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

const cleanInlineStyle = (raw: string, stripColors: boolean) =>
  raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const prop = chunk.split(":")[0]?.trim().toLowerCase();
      if (!prop) return false;
      if (BLOCKED_STYLE_PROPS.has(prop)) return false;
      if (stripColors && COLOR_STYLE_PROPS.has(prop)) return false;
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
        node.remove();
        return;
      }
      node.removeAttribute("width");
      node.removeAttribute("height");
      node.style.setProperty("max-width", "100%", "important");
      node.style.setProperty("max-height", "420px", "important");
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("width", "auto", "important");
      node.style.setProperty("object-fit", "contain", "important");
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
      const cleaned = cleanInlineStyle(
        node.getAttribute("style") ?? "",
        !preserveColorsInHook,
      );
      if (cleaned) {
        node.setAttribute("style", cleaned);
      } else {
        node.removeAttribute("style");
      }
    }

    node.style.position = "static";
    node.style.float = "none";
    node.style.zIndex = "auto";
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
