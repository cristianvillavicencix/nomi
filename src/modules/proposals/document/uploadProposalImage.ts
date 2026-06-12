import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { optimizeImageForUpload } from "@/modules/deals/projectResourceImageOptimize";

/** Upload proposal deck / hero images to the public attachments bucket. */
export async function uploadProposalImage(
  file: File,
  orgId: string | number,
  proposalId: string | number,
): Promise<string> {
  const optimized = await optimizeImageForUpload(file);
  const ext = optimized.name.includes(".")
    ? optimized.name.slice(optimized.name.lastIndexOf("."))
    : ".webp";
  const path = `proposals/${orgId}/${proposalId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, optimized, {
    contentType: optimized.type || "image/webp",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}

export const isProposalImageUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/")
  );
};
