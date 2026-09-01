import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { downloadPrivateStorageFile } from "@/lib/supabase/privateStorageFile";
import {
  buildMessagingAttachmentPathOutbound,
  isLegacyPublicMediaUrl,
  MESSAGING_ATTACHMENTS_BUCKET,
} from "@/modules/messages/messagingStorage";

export const uploadSmsMedia = async (file: File, orgId?: string | number) => {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : file.type.startsWith("image/")
      ? ".jpg"
      : "";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const path = buildMessagingAttachmentPathOutbound(
    orgId ?? "unknown",
    fileName,
  );
  const { error } = await supabase.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return path;
};

export const createSignedMediaUrl = async (
  storagePath: string,
  expiresIn = 3600,
) => {
  if (isLegacyPublicMediaUrl(storagePath)) {
    return storagePath;
  }
  const { data, error } = await supabase.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to create signed media URL");
  }
  return data.signedUrl;
};

export const getMediaFileName = (urlOrPath: string) => {
  if (isLegacyPublicMediaUrl(urlOrPath)) {
    try {
      const pathname = new URL(urlOrPath).pathname;
      const base = pathname.split("/").pop() ?? "attachment";
      return decodeURIComponent(base);
    } catch {
      return "attachment";
    }
  }
  const base = urlOrPath.split("/").pop() ?? "attachment";
  return decodeURIComponent(base);
};

export const downloadMediaUrl = async (urlOrPath: string) => {
  const fileName = getMediaFileName(urlOrPath);
  if (isLegacyPublicMediaUrl(urlOrPath)) {
    try {
      await downloadPrivateStorageFile({
        reference: urlOrPath,
        filename: fileName,
      });
    } catch {
      throw new Error(
        "Could not download this attachment. Ask the sender to resend the image.",
      );
    }
    return;
  }
  await downloadPrivateStorageFile({
    bucket: MESSAGING_ATTACHMENTS_BUCKET,
    path: urlOrPath,
    filename: fileName,
  });
};

export const isImageMediaUrl = (urlOrPath: string) =>
  /\.(jpe?g|png|gif|webp)(\?|$)/i.test(urlOrPath) ||
  urlOrPath.includes("image/");
