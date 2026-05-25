import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { optimizeImageForUpload } from "@/lbs/deals/projectResourceImageOptimize";

export type UploadedFormFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  path?: string;
  bucket?: string;
  mime_type?: string;
  original_name?: string;
};

type UploadFormFileOptions = {
  token: string;
  fieldKey: string;
  groupKey?: string;
  /** @deprecated Use token-based upload instead */
  formId?: number;
};

export async function uploadFormFile(
  file: File,
  options: UploadFormFileOptions | number,
): Promise<UploadedFormFile> {
  const resolved =
    typeof options === "number"
      ? { token: "", fieldKey: "file", formId: options }
      : options;

  if (resolved.token) {
    const optimized = await optimizeImageForUpload(file);
    const formData = new FormData();
    formData.append("token", resolved.token);
    formData.append("field_key", resolved.fieldKey);
    if (resolved.groupKey) {
      formData.append("group_key", resolved.groupKey);
    }
    formData.append("file", optimized);

    const { data, error } = await supabase.functions.invoke<UploadedFormFile>(
      "upload_form_file",
      {
        body: formData,
        headers: {
          apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        },
      },
    );

    if (error || !data?.url) {
      console.error("upload_form_file.error", error);
      throw new Error(error?.message || "Failed to upload file");
    }

    return data;
  }

  const formId = resolved.formId;
  if (!formId) {
    throw new Error("Missing upload context");
  }

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";
  const path = `form-uploads/${formId}/${crypto.randomUUID()}${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = supabase.storage.from("attachments").getPublicUrl(path);
  return {
    name: file.name,
    url: publicUrl.publicUrl,
    size: file.size,
    type: file.type,
    path,
    bucket: "attachments",
    mime_type: file.type,
    original_name: file.name,
  };
}
