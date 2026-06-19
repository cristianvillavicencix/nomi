import DOMPurify from "dompurify";

let emailHtmlHookInstalled = false;

const BLOCKED_STYLE_PROPS = new Set([
  "position",
  "float",
  "z-index",
  "top",
  "left",
  "right",
  "bottom",
  "transform",
  "margin-top",
  "margin-left",
  "margin-right",
]);

const cleanInlineStyle = (raw: string) =>
  raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => {
      const prop = chunk.split(":")[0]?.trim().toLowerCase();
      if (!prop) return false;
      if (BLOCKED_STYLE_PROPS.has(prop)) return false;
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
          : node.getAttribute("src") ?? node.getAttribute("data") ?? "";

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

    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }

    if (node.hasAttribute("style")) {
      const cleaned = cleanInlineStyle(node.getAttribute("style") ?? "");
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

export const sanitizeTicketEmailHtml = (
  html: string,
  options?: {
    /** Hrefs removed from HTML because they render in the attachments panel. */
    stripHrefs?: string[];
    attachmentSrcs?: string[];
    attachmentTitles?: string[];
  },
) => {
  installEmailSanitizeHooks();

  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "style", "bgcolor", "align", "valign", "width", "height"],
    FORBID_TAGS: ["form", "iframe", "object", "embed"],
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
