import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  ProjectResourceCategory,
  ProjectResourceFile,
} from "@/lbs/deals/projectResourceConstants";

const PROJECT_FILES_BUCKET = "project-files";

const inferMimeKind = (mime: string): string => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("text")) return "document";
  return "other";
};

/** Upload to private project-files bucket; returns path (signed URL fetched on read). */
export const uploadProjectResourceFile = async (
  dealId: Identifier,
  file: File,
  orgId?: Identifier | null,
): Promise<ProjectResourceFile> => {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const orgSegment = orgId != null ? String(orgId) : "unknown";
  const path = `${orgSegment}/${dealId}/${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(PROJECT_FILES_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    // Fallback legacy bucket for environments without migration yet
    const legacyPath = `project-resources/${dealId}/${crypto.randomUUID()}${ext}`;
    const legacy = await supabase.storage.from("attachments").upload(legacyPath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (legacy.error) throw legacy.error;
    const { data } = supabase.storage.from("attachments").getPublicUrl(legacyPath);
    return {
      title: file.name,
      type: file.type || "application/octet-stream",
      path: legacyPath,
      src: data.publicUrl,
      bucket: "attachments",
    };
  }

  const { data: signed } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(path, 3600);

  return {
    title: file.name,
    type: file.type || "application/octet-stream",
    path,
    src: signed.data?.signedUrl ?? "",
    bucket: PROJECT_FILES_BUCKET,
  };
};

export const getProjectResourceSignedUrl = async (path: string, bucket = PROJECT_FILES_BUCKET) => {
  if (bucket === "attachments") {
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};

export type CreateProjectResourceInput = {
  dealId: Identifier;
  category: ProjectResourceCategory;
  label?: string;
  file: ProjectResourceFile;
  source?: "team" | "client";
  visibility?: "internal" | "client" | "public";
};

export const buildProjectResourceRecord = ({
  dealId,
  category,
  label,
  file,
  source = "team",
  visibility = source === "client" ? "client" : "internal",
}: CreateProjectResourceInput) => ({
  deal_id: dealId,
  category,
  label: label?.trim() || null,
  file,
  source,
  visibility,
  mime_kind: inferMimeKind(file.type ?? ""),
});
