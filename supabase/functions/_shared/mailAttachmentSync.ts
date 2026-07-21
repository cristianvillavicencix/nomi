import type { MailAccountRow } from "./mailAccount.ts";
import {
  decodeBase64ToBytes,
  syncAttachmentBatch,
} from "./mailAttachmentStorage.ts";

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

export type GmailAttachmentMeta = {
  filename: string;
  mimeType: string;
  attachmentId: string;
};

export function collectGmailAttachmentParts(
  part: GmailPart | undefined,
  out: GmailAttachmentMeta[] = [],
): GmailAttachmentMeta[] {
  if (!part) return out;
  const filename = part.filename?.trim();
  const attachmentId = part.body?.attachmentId;
  const mime = String(part.mimeType || "").toLowerCase();
  if (
    filename &&
    attachmentId &&
    mime !== "text/plain" &&
    mime !== "text/html"
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

export function gmailMessageHasFileAttachments(
  payload: GmailPart | undefined,
): boolean {
  return collectGmailAttachmentParts(payload).length > 0;
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
  const metas = collectGmailAttachmentParts(payload);
  if (metas.length === 0) return 0;

  const files: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  }> = [];

  for (const meta of metas) {
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
  }> = [];

  for (const att of json.value ?? []) {
    const odataType = String(att["@odata.type"] || "");
    if (!odataType.includes("fileAttachment")) continue;
    const contentBytes = att.contentBytes;
    if (typeof contentBytes !== "string" || !contentBytes.trim()) continue;
    const id = String(att.id || att.name || files.length);
    files.push({
      providerAttachmentId: id,
      filename: String(att.name || "attachment"),
      mimeType: String(att.contentType || "application/octet-stream"),
      bytes: decodeBase64ToBytes(contentBytes.replace(/\s+/g, "")),
    });
  }

  return syncAttachmentBatch(
    messageId,
    account.org_id,
    account.id,
    files,
  );
}
