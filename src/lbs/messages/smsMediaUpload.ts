import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export const uploadSmsMedia = async (file: File) => {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : file.type.startsWith("image/")
      ? ".jpg"
      : "";
  const path = `sms-outbound/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
};

export const getMediaFileName = (url: string) => {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() ?? "attachment";
    return decodeURIComponent(base);
  } catch {
    return "attachment";
  }
};

export const downloadMediaUrl = async (url: string) => {
  const fileName = getMediaFileName(url);
  try {
    const response = await fetch(url);
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
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export const isImageMediaUrl = (url: string) =>
  /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || url.includes("image/");
