import { supabaseAdmin } from "./supabaseAdmin.ts";
import type { EmailAttachment } from "./transactionalEmail.ts";

export type StoredAttachment = {
  title?: string;
  type?: string;
  path?: string;
  src?: string;
  size?: number;
  /** When true, never load bytes into Edge — email a signed download link. */
  send_as_download_link?: boolean;
};

export type LoadedEmailAttachments = {
  attachments: EmailAttachment[];
  requestedCount: number;
  loadedCount: number;
  totalBytes: number;
  missingCount: number;
};

const uint8ToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j += 1) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
};

export const loadStorageAttachmentsForEmail = async (
  attachments: StoredAttachment[] | undefined,
  bucket = "attachments",
): Promise<LoadedEmailAttachments> => {
  if (!attachments?.length) {
    return {
      attachments: [],
      requestedCount: 0,
      loadedCount: 0,
      totalBytes: 0,
      missingCount: 0,
    };
  }

  const emailAttachments: EmailAttachment[] = [];
  let totalBytes = 0;
  let requestedCount = 0;

  for (const file of attachments) {
    const path = file.path?.trim();
    if (!path) continue;

    requestedCount += 1;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);
    if (error || !data) {
      console.error("storage_attachments.download_failed", path, error);
      continue;
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    totalBytes += bytes.byteLength;
    emailAttachments.push({
      name: file.title?.trim() || path.split("/").pop() || "attachment",
      contentType: file.type?.trim() || "application/octet-stream",
      contentBase64: uint8ToBase64(bytes),
    });
  }

  return {
    attachments: emailAttachments,
    requestedCount,
    loadedCount: emailAttachments.length,
    totalBytes,
    missingCount: Math.max(requestedCount - emailAttachments.length, 0),
  };
};
