import type { MailAccountRow } from "./mailAccount.ts";
import {
  decodeBase64ToBytes,
  syncAttachmentBatch,
} from "./mailAttachmentStorage.ts";
import { normalizeContentId } from "./mailInlineImages.ts";

type GmailHeader = { name?: string; value?: string };

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

export type GmailAttachmentMeta = {
  filename: string;
  mimeType: string;
  attachmentId: string;
};

export type GmailInlineImageMeta = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  contentId: string;
  embeddedBytes?: Uint8Array;
};

function getGmailPartHeader(
  part: GmailPart | undefined,
  name: string,
): string | null {
  const header = part?.headers?.find(
    (h) => String(h.name || "").toLowerCase() === name.toLowerCase(),
  );
  return header?.value?.trim() || null;
}

export function collectGmailAttachmentParts(
  part: GmailPart | undefined,
  out: GmailAttachmentMeta[] = [],
): GmailAttachmentMeta[] {
  if (!part) return out;
  const filename = part.filename?.trim();
  const attachmentId = part.body?.attachmentId;
  const mime = String(part.mimeType || "").toLowerCase();
  const contentId = getGmailPartHeader(part, "Content-ID");
  if (
    filename &&
    attachmentId &&
    mime !== "text/plain" &&
    mime !== "text/html" &&
    !(contentId && mime.startsWith("image/"))
  ) {
    out.push({
      filename,
      mimeType: part.mimeType || "application/octet-stream",
      attachmentId,
    });
  }
  for (const child of part.parts ?? []) {
    collectGmailAttachmentParts(child, out);
  }
  return out;
}

export function collectGmailInlineImageParts(
  part: GmailPart | undefined,
  out: GmailInlineImageMeta[] = [],
): GmailInlineImageMeta[] {
  if (!part) return out;
  const mime = String(part.mimeType || "").toLowerCase();
  const contentId = getGmailPartHeader(part, "Content-ID");
  const attachmentId = part.body?.attachmentId;
  const embeddedData = part.body?.data;

  if (contentId && mime.startsWith("image/")) {
    const normalized = normalizeContentId(contentId);
    const filename =
      part.filename?.trim() ||
      `inline-${normalized.slice(0, 48) || "image"}`;
    if (attachmentId) {
      out.push({
        filename,
        mimeType: part.mimeType || "image/png",
        attachmentId,
        contentId,
      });
    } else if (embeddedData) {
      out.push({
        filename,
        mimeType: part.mimeType || "image/png",
        attachmentId: `inline-${normalized || out.length}`,
        contentId,
        embeddedBytes: decodeBase64ToBytes(embeddedData),
      });
    }
  }

  for (const child of part.parts ?? []) {
    collectGmailInlineImageParts(child, out);
  }
  return out;
}

export function gmailMessageHasFileAttachments(
  payload: GmailPart | undefined,
): boolean {
  return collectGmailAttachmentParts(payload).length > 0;
}

export function gmailMessageHasInlineImages(
  payload: GmailPart | undefined,
): boolean {
  return collectGmailInlineImageParts(payload).length > 0;
}

async function fetchGmailAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.data || typeof json.data !== "string") return null;
  return decodeBase64ToBytes(json.data);
}

export async function syncGmailMessageAttachments(
  accessToken: string,
  account: MailAccountRow,
  providerMessageId: string,
  messageId: number,
  payload: GmailPart | undefined,
): Promise<number> {
  const fileMetas = collectGmailAttachmentParts(payload);
  const inlineMetas = collectGmailInlineImageParts(payload);
  if (fileMetas.length === 0 && inlineMetas.length === 0) return 0;

  const files: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
    contentId?: string | null;
  }> = [];

  for (const meta of fileMetas) {
    const bytes = await fetchGmailAttachmentBytes(
      accessToken,
      providerMessageId,
      meta.attachmentId,
    );
    if (!bytes) continue;
    files.push({
      providerAttachmentId: meta.attachmentId,
      filename: meta.filename,
      mimeType: meta.mimeType,
      bytes,
    });
  }

  for (const meta of inlineMetas) {
    const bytes =
      meta.embeddedBytes ??
      (await fetchGmailAttachmentBytes(
        accessToken,
        providerMessageId,
        meta.attachmentId,
      ));
    if (!bytes) continue;
    files.push({
      providerAttachmentId: meta.attachmentId,
      filename: meta.filename,
      mimeType: meta.mimeType,
      bytes,
      contentId: meta.contentId,
    });
  }

  return syncAttachmentBatch(
    messageId,
    account.org_id,
    account.id,
    files,
  );
}

export async function syncGraphMessageAttachments(
  accessToken: string,
  account: MailAccountRow,
  providerMessageId: string,
  messageId: number,
): Promise<number> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(providerMessageId)}/attachments?$top=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return 0;
  const json = await res.json();
  const files: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
    contentId?: string | null;
  }> = [];

  for (const att of json.value ?? []) {
    const odataType = String(att["@odata.type"] || "");
    if (!odataType.includes("fileAttachment")) continue;
    const contentBytes = att.contentBytes;
    if (typeof contentBytes !== "string" || !contentBytes.trim()) continue;
    const id = String(att.id || att.name || files.length);
    const isInline = Boolean(att.isInline);
    const contentId = typeof att.contentId === "string"
      ? att.contentId.trim()
      : null;
    const mimeType = String(att.contentType || "application/octet-stream");
    if (isInline && contentId && !mimeType.toLowerCase().startsWith("image/")) {
      continue;
    }
    if (isInline && !contentId) continue;
    if (!isInline && !String(att.name || "").trim()) continue;
    files.push({
      providerAttachmentId: id,
      filename: String(att.name || "attachment"),
      mimeType,
      bytes: decodeBase64ToBytes(contentBytes.replace(/\s+/g, "")),
      contentId: isInline ? contentId : null,
    });
  }

  return syncAttachmentBatch(
    messageId,
    account.org_id,
    account.id,
    files,
  );
}
