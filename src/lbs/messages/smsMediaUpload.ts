import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  buildMessagingAttachmentPathOutbound,
  isLegacyPublicMediaUrl,
  MESSAGING_ATTACHMENTS_BUCKET,
} from "@/lbs/messages/messagingStorage";

export const uploadSmsMedia = async (file: File, orgId?: string | number) => {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : file.type.startsWith("image/")
      ? ".jpg"
      : "";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const path = buildMessagingAttachmentPathOutbound(orgId ?? "unknown", fileName);
  const { error } = await supabase.storage
    .from(MESSAGING_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return path;
};

export const createSignedMediaUrl = async (storagePath: string, expiresIn = 3600) => {
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
  const resolvedUrl = isLegacyPublicMediaUrl(urlOrPath)
    ? urlOrPath
    : await createSignedMediaUrl(urlOrPath);
  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(resolvedUrl, "_blank", "noopener,noreferrer");
  }
};

export const isImageMediaUrl = (urlOrPath: string) =>
  /\.(jpe?g|png|gif|webp)(\?|$)/i.test(urlOrPath) || urlOrPath.includes("image/");
