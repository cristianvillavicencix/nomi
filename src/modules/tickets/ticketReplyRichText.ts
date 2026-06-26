import { LBS_SUPPORT_SIGNATURE } from "@/modules/tickets/ticketReplyTemplates";
import { sanitizeTicketEmailHtml } from "@/modules/tickets/sanitizeTicketEmailHtml";

export const TICKET_REPLY_SIGNATURE_SELECTOR =
  '[data-ticket-reply-signature="true"]';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const htmlToPlainText = (html: string) => {
  if (!html.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.innerText || container.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const plainTextToEditorHtml = (text: string) => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "<p><br></p>";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map(escapeHtml).join("<br>");
      return `<p>${lines || "<br>"}</p>`;
    })
    .join("");
};

export const buildReplySignatureEditorHtml = (
  signatureHtml?: string | null,
) => {
  if (signatureHtml?.trim()) {
    const trimmed = signatureHtml.trim();
    if (trimmed.includes("<")) {
      return `<div data-ticket-reply-signature="true" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">${trimmed}</div>`;
    }
    const lines = trimmed
      .split("\n")
      .map((line) => `<p style="margin:0;">${escapeHtml(line)}</p>`)
      .join("");
    return `<div data-ticket-reply-signature="true" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;color:#374151;font-size:13px;line-height:1.5;">${lines}</div>`;
  }

  const lines = LBS_SUPPORT_SIGNATURE.split("\n")
    .map((line) => `<p style="margin:0;">${escapeHtml(line)}</p>`)
    .join("");

  return `<div data-ticket-reply-signature="true" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;color:#374151;font-size:13px;line-height:1.5;">${lines}</div>`;
};

export const createDefaultReplyHtml = (signatureHtml?: string | null) =>
  `<p><br></p>${buildReplySignatureEditorHtml(signatureHtml)}`;

export const includesReplySignatureHtml = (html: string) =>
  html.includes('data-ticket-reply-signature="true"') ||
  html.includes(LBS_SUPPORT_SIGNATURE);

export const stripReplySignatureHtml = (html: string) => {
  if (typeof document === "undefined") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  container
    .querySelectorAll(TICKET_REPLY_SIGNATURE_SELECTOR)
    .forEach((node) => node.remove());

  return container.innerHTML.trim();
};

export const hasReplyContentHtml = (html: string) => {
  const plain = htmlToPlainText(stripReplySignatureHtml(html));
  return Boolean(plain.trim());
};

const isEmptyEditorBlockHtml = (html: string) => !htmlToPlainText(html).trim();

const removeEmptyLeadingBlocks = (
  container: HTMLElement,
  stopBefore: Element | null,
) => {
  let node = container.firstChild;
  while (node && node !== stopBefore) {
    if (node.nodeType !== Node.ELEMENT_NODE) break;
    const element = node as HTMLElement;
    if (element.matches(TICKET_REPLY_SIGNATURE_SELECTOR)) break;
    if (!isEmptyEditorBlockHtml(element.outerHTML)) break;
    const next = node.nextSibling;
    element.remove();
    node = next;
  }
};

export const insertAboveSignatureHtml = (html: string, text: string) => {
  const insertion = plainTextToEditorHtml(text);
  if (!includesReplySignatureHtml(html)) {
    const trimmed = html.trim();
    if (!trimmed) return `${insertion}${buildReplySignatureEditorHtml()}`;
    return `${trimmed}${insertion}${buildReplySignatureEditorHtml()}`;
  }

  if (typeof document === "undefined") {
    return `${insertion}${html}`;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const signature = container.querySelector(TICKET_REPLY_SIGNATURE_SELECTOR);
  if (!signature) {
    return `${insertion}${html}`;
  }

  removeEmptyLeadingBlocks(container, signature);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = insertion;
  while (wrapper.firstChild) {
    container.insertBefore(wrapper.firstChild, signature);
  }

  removeEmptyLeadingBlocks(container, signature);

  return container.innerHTML;
};

export const focusRichEditor = (editor: HTMLElement | null) => {
  if (!editor) return;
  editor.focus();
};

export const execRichEditorCommand = (
  editor: HTMLElement | null,
  command: string,
  value?: string,
) => {
  focusRichEditor(editor);
  document.execCommand(command, false, value);
};

export const insertRichEditorText = (
  editor: HTMLElement | null,
  text: string,
) => {
  focusRichEditor(editor);
  document.execCommand("insertText", false, text);
};

export const insertRichEditorLink = (editor: HTMLElement | null) => {
  focusRichEditor(editor);
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || "link";
  const url = window.prompt("Link URL", "https://");
  if (!url?.trim()) return;

  if (!selection?.toString()) {
    document.execCommand(
      "insertHTML",
      false,
      `<a href="${escapeHtml(url.trim())}">${escapeHtml(selectedText)}</a>`,
    );
    return;
  }

  document.execCommand("createLink", false, url.trim());
};

export const sanitizeComposerHtml = (html: string) => {
  if (typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  container
    .querySelectorAll("script,style,iframe,object,embed")
    .forEach((node) => {
      node.remove();
    });

  container.querySelectorAll("img").forEach((node) => {
    const src = node.getAttribute("src")?.trim().toLowerCase() ?? "";
    if (src.startsWith("cid:")) {
      node.remove();
    }
  });

  container.querySelectorAll("*").forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        node.removeAttribute(attribute.name);
      }
    }
  });

  return container.innerHTML;
};
