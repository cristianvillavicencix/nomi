import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export type UploadedFormFile = {
  name: string;
  url: string;
  size: number;
  type: string;
};

export async function uploadFormFile(
  file: File,
  formId: number,
): Promise<UploadedFormFile> {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";
  const path = `form-uploads/${formId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return {
    name: file.name,
    url: data.publicUrl,
    size: file.size,
    type: file.type,
  };
}
