import { supabaseAdmin } from "./supabaseAdmin.ts";
import type { EmailAttachment } from "./transactionalEmail.ts";

export type StoredAttachment = {
  title?: string;
  type?: string;
  path?: string;
  src?: string;
};

const uint8ToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const loadStorageAttachmentsForEmail = async (
  attachments: StoredAttachment[] | undefined,
  bucket = "attachments",
): Promise<EmailAttachment[]> => {
  if (!attachments?.length) return [];

  const emailAttachments: EmailAttachment[] = [];

  for (const file of attachments) {
    const path = file.path?.trim();
    if (!path) continue;

    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (error || !data) {
      console.error("storage_attachments.download_failed", path, error);
      continue;
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    emailAttachments.push({
      name: file.title?.trim() || path.split("/").pop() || "attachment",
      contentType: file.type?.trim() || "application/octet-stream",
      contentBase64: uint8ToBase64(bytes),
    });
  }

  return emailAttachments;
};
