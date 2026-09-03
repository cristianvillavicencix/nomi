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

  // Avoid fetch() blob downloads for private storage:
  // some signed storage URLs allow <img> rendering but block fetch due to CORS.
  // Downloading via the signed URL navigation is more reliable.
  const signedUrl = await createSignedMediaUrl(urlOrPath);
  if (!signedUrl) {
    throw new Error(
      "Could not download this attachment. Ask the sender to resend the image.",
    );
  }

  const anchor = document.createElement("a");
  anchor.href = signedUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const isImageMediaUrl = (urlOrPath: string) =>
  /\.(jpe?g|png|gif|webp)(\?|$)/i.test(urlOrPath) ||
  urlOrPath.includes("image/");
