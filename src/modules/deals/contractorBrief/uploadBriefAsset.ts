import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { optimizeImageForUpload } from "@/modules/deals/projectResourceImageOptimize";
import type { UploadedFormFile } from "@/modules/forms/public/uploadFormFile";

const BRIEF_ASSETS_BUCKET = "attachments";

export const uploadBriefAsset = async (
  dealId: Identifier,
  file: File,
  orgId?: Identifier | null,
): Promise<UploadedFormFile> => {
  const optimized = await optimizeImageForUpload(file);
  const ext = optimized.name.includes(".")
    ? optimized.name.slice(optimized.name.lastIndexOf("."))
    : "";
  const orgSegment = orgId != null ? String(orgId) : "unknown";
  const path = `brief-assets/${orgSegment}/${dealId}/${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage
    .from(BRIEF_ASSETS_BUCKET)
    .upload(path, optimized, {
      contentType: optimized.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BRIEF_ASSETS_BUCKET).getPublicUrl(path);

  return {
    name: optimized.name,
    url: data.publicUrl,
    size: optimized.size,
    type: optimized.type || "application/octet-stream",
    path,
    bucket: BRIEF_ASSETS_BUCKET,
    mime_type: optimized.type,
    original_name: file.name,
  };
};

export const readBriefUploadedFiles = (value: unknown): UploadedFormFile[] => {
  if (Array.isArray(value)) return value as UploadedFormFile[];
  if (value && typeof value === "object") return [value as UploadedFormFile];
  return [];
};
