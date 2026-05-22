import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  ProjectResourceCategory,
  ProjectResourceFile,
} from "@/lbs/deals/projectResourceConstants";

export const uploadProjectResourceFile = async (
  dealId: Identifier,
  file: File,
): Promise<ProjectResourceFile> => {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";
  const path = `project-resources/${dealId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return {
    title: file.name,
    type: file.type || "application/octet-stream",
    path,
    src: data.publicUrl,
  };
};

export type CreateProjectResourceInput = {
  dealId: Identifier;
  category: ProjectResourceCategory;
  label?: string;
  file: ProjectResourceFile;
  source?: "team" | "client";
};

export const buildProjectResourceRecord = ({
  dealId,
  category,
  label,
  file,
  source = "team",
}: CreateProjectResourceInput) => ({
  deal_id: dealId,
  category,
  label: label?.trim() || null,
  file,
  source,
});
