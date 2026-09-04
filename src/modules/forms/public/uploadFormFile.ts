import { optimizeImageForUpload } from "@/modules/deals/projectResourceImageOptimize";

export type UploadedFormFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  path?: string;
  bucket?: string;
  mime_type?: string;
  original_name?: string;
  /** Existing deal_resources.id when reopening a request link. */
  resource_id?: number;
};

type UploadFormFileOptions = {
  token: string;
  fieldKey: string;
  groupKey?: string;
};

export async function uploadFormFile(
  file: File,
  options: UploadFormFileOptions | number,
): Promise<UploadedFormFile> {
  if (typeof options === "number") {
    throw new Error(
      "Legacy form uploads require a public form token. Reopen the form link and try again.",
    );
  }

  const resolved = options;

  if (!resolved.token?.trim()) {
    throw new Error("Missing form upload token");
  }

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

  const response = await fetch(`${supabaseUrl}/functions/v1/upload_form_file`, {
    method: "POST",
    headers: { apikey },
    body: formData,
  });

  const data = (await response.json()) as UploadedFormFile & {
    error?: string;
    message?: string;
  };

  if (!response.ok || !data?.url) {
    const message = data?.error ?? data?.message ?? "Failed to upload file";
    console.error("upload_form_file.error", message);
    throw new Error(message);
  }

  return data;
}
