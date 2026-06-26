import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { optimizeImageForUpload } from "@/modules/deals/projectResourceImageOptimize";
import {
  buildStorageObjectReference,
  createStorageSignedUrl,
} from "@/lib/supabase/storageObjectUrl";

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

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
      /\/$/,
      "",
    );
    const apikey = import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined;
    if (!supabaseUrl || !apikey) {
      throw new Error("Supabase is not configured");
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/upload_form_file`,
      {
        method: "POST",
        headers: { apikey },
        body: formData,
      },
    );

    const data = (await response.json()) as UploadedFormFile & {
      error?: string;
      message?: string;
    };

    if (!response.ok || !data?.url) {
      const message =
        data?.error ?? data?.message ?? "Failed to upload file";
      console.error("upload_form_file.error", message);
      throw new Error(message);
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
  const reference = buildStorageObjectReference("attachments", path);
  const signed =
    (await createStorageSignedUrl("attachments", path, 3600)) ?? reference;
  return {
    name: file.name,
    url: signed,
    size: file.size,
    type: file.type,
    path,
    bucket: "attachments",
    mime_type: file.type,
    original_name: file.name,
  };
}
