import { supabaseAdmin } from "./supabaseAdmin.ts";

export const MAIL_ATTACHMENTS_BUCKET = "mail-attachments";

export const MAIL_ATTACHMENT_MAX_FILES = 5;
export const MAIL_ATTACHMENT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAIL_ATTACHMENT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export function sanitizeMailAttachmentFilename(name: string): string {
  return (
    name.replace(/[\r\n"\\]/g, "_").replace(/\//g, "_").slice(0, 180) ||
    "attachment"
  );
}

export function decodeBase64ToBytes(data: string): Uint8Array {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function attachmentAlreadyStored(
  messageId: number,
  providerAttachmentId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("mail_attachments")
    .select("id")
    .eq("message_id", messageId)
    .eq("provider_attachment_id", providerAttachmentId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function storeMailAttachment(params: {
  orgId: number;
  accountId: number;
  messageId: number;
  providerAttachmentId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<boolean> {
  const { bytes } = params;
  if (bytes.length === 0 || bytes.length > MAIL_ATTACHMENT_MAX_FILE_BYTES) {
    return false;
  }

  if (
    await attachmentAlreadyStored(
      params.messageId,
      params.providerAttachmentId,
    )
  ) {
    return true;
  }

  const safeName = sanitizeMailAttachmentFilename(params.filename);
  const storagePath =
    `${params.orgId}/${params.accountId}/${params.messageId}/${params.providerAttachmentId}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MAIL_ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: params.mimeType || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    console.error("mail_attachment_upload_failed", uploadError.message);
    return false;
  }

  const { error: insertError } = await supabaseAdmin
    .from("mail_attachments")
    .insert({
      message_id: params.messageId,
      account_id: params.accountId,
      org_id: params.orgId,
      provider_attachment_id: params.providerAttachmentId,
      filename: safeName,
      mime_type: params.mimeType || null,
      size_bytes: bytes.length,
      storage_path: storagePath,
    });
  if (insertError) {
    console.error("mail_attachment_row_failed", insertError.message);
    return false;
  }
  return true;
}

export async function messageHasStoredAttachments(
  messageId: number,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("mail_attachments")
    .select("id")
    .eq("message_id", messageId)
    .not("storage_path", "is", null)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function syncAttachmentBatch(
  messageId: number,
  orgId: number,
  accountId: number,
  files: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  }>,
): Promise<number> {
  let stored = 0;
  let totalBytes = 0;
  for (const file of files.slice(0, MAIL_ATTACHMENT_MAX_FILES)) {
    if (file.bytes.length > MAIL_ATTACHMENT_MAX_FILE_BYTES) continue;
    if (totalBytes + file.bytes.length > MAIL_ATTACHMENT_MAX_TOTAL_BYTES) {
      break;
    }
    const ok = await storeMailAttachment({
      orgId,
      accountId,
      messageId,
      providerAttachmentId: file.providerAttachmentId,
      filename: file.filename,
      mimeType: file.mimeType,
      bytes: file.bytes,
    });
    if (ok) {
      stored += 1;
      totalBytes += file.bytes.length;
    }
  }
  return stored;
}
