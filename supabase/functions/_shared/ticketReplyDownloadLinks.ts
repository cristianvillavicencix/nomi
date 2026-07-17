import { createStorageSignedUrl } from "./storageObjectUrl.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import type { StoredAttachment } from "./storageAttachmentsForEmail.ts";

/** Same retention as invoice deliverable download links. */
export const REPLY_DOWNLOAD_LINK_EXPIRES_SEC = 60 * 60 * 24 * 7; // 7 days

export type ReplyDownloadLink = {
  name: string;
  url: string;
};

export const buildReplyAttachmentDownloadLinks = async (
  files: StoredAttachment[],
  bucket = "attachments",
): Promise<ReplyDownloadLink[]> => {
  const links: ReplyDownloadLink[] = [];

  for (const file of files) {
    const path = file.path?.trim();
    const name = file.title?.trim() || path?.split("/").pop() || "file";
    if (!path) {
      throw new Error(
        `Could not create a download link for "${name}" (missing storage path).`,
      );
    }

    const signed = await createStorageSignedUrl(
      supabaseAdmin,
      bucket,
      path,
      REPLY_DOWNLOAD_LINK_EXPIRES_SEC,
    );
    if (!signed) {
      throw new Error(
        `Could not create a download link for "${name}". Try again or share the file manually.`,
      );
    }
    links.push({ name, url: signed });
  }

  return links;
};

const fileExtension = (name: string) => {
  const base = name.trim().split(/[/\\]/).pop() || name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
};

const extensionGroupLabel = (ext: string) => {
  if (!ext) return "Other files";
  return `${ext.toUpperCase()} files`;
};

const groupLinksByExtension = (links: ReplyDownloadLink[]) => {
  const groups = new Map<string, ReplyDownloadLink[]>();
  for (const link of links) {
    const ext = fileExtension(link.name);
    const key = ext || "_other";
    const list = groups.get(key) ?? [];
    list.push(link);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "_other") return 1;
    if (b === "_other") return -1;
    return a.localeCompare(b);
  });
};

const buildDownloadLinksTextBlock = (links: ReplyDownloadLink[]) => {
  const header = "To download, click below (links expire in 7 days):";
  const groups = groupLinksByExtension(links);
  const useGroupHeaders = links.length > 1 && groups.length > 1;

  const lines: string[] = [header, ""];
  for (const [key, group] of groups) {
    if (useGroupHeaders) {
      lines.push(
        key === "_other" ? "Other files" : extensionGroupLabel(key),
      );
    }
    for (const file of group) {
      lines.push(`• ${file.name}: ${file.url}`);
    }
    if (useGroupHeaders) lines.push("");
  }

  return lines.join("\n").trim();
};

const buildDownloadLinksHtmlBlock = (links: ReplyDownloadLink[]) => {
  const groups = groupLinksByExtension(links);
  const useGroupHeaders = links.length > 1 && groups.length > 1;

  const sections = groups
    .map(([key, group]) => {
      const list = group
        .map(
          (file) =>
            `<li style="margin:0 0 6px;"><a href="${escapeHtml(file.url)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(file.name)}</a></li>`,
        )
        .join("");
      const heading = useGroupHeaders
        ? `<p style="margin:10px 0 4px;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(
            key === "_other" ? "Other files" : extensionGroupLabel(key),
          )}</p>`
        : "";
      return `${heading}<ul style="margin:0;padding-left:18px;">${list}</ul>`;
    })
    .join("");

  return (
    `<div data-ticket-reply-download-links="true" style="margin:16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;">` +
    `<p style="margin:0 0 8px;">To download, click below <span style="color:#6b7280;">(links expire in 7 days)</span>:</p>` +
    sections +
    `</div>`
  );
};

/**
 * Outbound reply HTML is typically:
 * user note → signature (border-top) → quoted thread.
 * Insert download links after the note and before signature/quote.
 */
const OUTBOUND_SECTION_START_RE =
  /<div[^>]*(?:data-ticket-reply-signature="true"|data-ticket-reply-quote="true"|style="[^"]*margin-top:\s*16px;\s*padding-top:\s*12px;\s*border-top:\s*1px\s+solid\s+#e5e7eb)[^>]*>/i;

const insertBlockBeforeOutboundSections = (html: string, block: string) => {
  const match = OUTBOUND_SECTION_START_RE.exec(html);
  if (match?.index != null) {
    return `${html.slice(0, match.index)}${block}${html.slice(match.index)}`;
  }
  return `${html}${block}`;
};

const QUOTED_PLAIN_START_RE = /(?:^|\n\n)(On .+ wrote:)/i;

export const appendReplyDownloadLinksToText = (
  body: string,
  links: ReplyDownloadLink[],
) => {
  if (!links.length) return body;
  const block = buildDownloadLinksTextBlock(links);
  const base = body.trim() || "(See download links)";

  // Prefer inserting before the "On … wrote:" quoted section.
  const match = QUOTED_PLAIN_START_RE.exec(base);
  if (match?.index != null) {
    const before = base.slice(0, match.index).trimEnd();
    const after = base.slice(match.index).trimStart();
    if (!before) return `${block}\n\n${after}`;
    return `${before}\n\n${block}\n\n${after}`;
  }

  return `${base}\n\n${block}`;
};

export const appendReplyDownloadLinksToHtml = (
  htmlBody: string | undefined,
  links: ReplyDownloadLink[],
) => {
  if (!links.length) return htmlBody;
  const block = buildDownloadLinksHtmlBlock(links);
  if (!htmlBody?.trim()) {
    return `<p>(See download links)</p>${block}`;
  }
  return insertBlockBeforeOutboundSections(htmlBody, block);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
