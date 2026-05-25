import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type UploadedAnswerFile = {
  name?: string;
  original_name?: string;
  url?: string;
  path?: string;
  bucket?: string;
  size?: number;
  type?: string;
  mime_type?: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "service";

const inferMimeKind = (mime: string): string => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("text")
  ) {
    return "document";
  }
  return "other";
};

const toDealResourceFile = (file: UploadedAnswerFile) => {
  const mime = file.mime_type ?? file.type ?? "application/octet-stream";
  return {
    title: file.original_name ?? file.name ?? "Upload",
    type: mime,
    path: file.path ?? "",
    src: file.url ?? "",
    bucket: file.bucket ?? "form-uploads",
  };
};

const readUploadedFiles = (value: unknown): UploadedAnswerFile[] => {
  if (Array.isArray(value)) return value as UploadedAnswerFile[];
  if (value && typeof value === "object") return [value as UploadedAnswerFile];
  return [];
};

export async function processProjectBriefSubmission(
  supabase: SupabaseClient,
  submission: {
    id: number;
    org_id: number;
    deal_id?: number | null;
  },
  answers: Record<string, unknown>,
) {
  const dealId = submission.deal_id;
  if (!dealId) return;

  const resourcesToInsert: Array<Record<string, unknown>> = [];

  for (const logo of readUploadedFiles(answers.logo_file)) {
    resourcesToInsert.push({
      org_id: submission.org_id,
      deal_id: dealId,
      category: "logo",
      label: logo.original_name ?? logo.name ?? "Logo",
      file: toDealResourceFile(logo),
      visibility: "internal",
      mime_kind: inferMimeKind(logo.mime_type ?? logo.type ?? ""),
      source: "project_brief",
      submitted_by_form: submission.id,
    });
  }

  const servicePhotos =
    answers.service_project_photos &&
    typeof answers.service_project_photos === "object" &&
    !Array.isArray(answers.service_project_photos)
      ? (answers.service_project_photos as Record<string, UploadedAnswerFile[]>)
      : {};

  for (const [service, photos] of Object.entries(servicePhotos)) {
    for (const photo of photos ?? []) {
      resourcesToInsert.push({
        org_id: submission.org_id,
        deal_id: dealId,
        category: `service:${slugify(service)}`,
        label: photo.original_name ?? photo.name ?? service,
        file: toDealResourceFile(photo),
        visibility: "internal",
        mime_kind: inferMimeKind(photo.mime_type ?? photo.type ?? ""),
        source: "project_brief",
        submitted_by_form: submission.id,
      });
    }
  }

  const insertServicePhotoMap = (
    answerKey: string,
    labelPrefix: string,
  ) => {
    const map =
      answers[answerKey] &&
      typeof answers[answerKey] === "object" &&
      !Array.isArray(answers[answerKey])
        ? (answers[answerKey] as Record<string, UploadedAnswerFile[]>)
        : {};

    for (const [service, photos] of Object.entries(map)) {
      for (const photo of photos ?? []) {
        resourcesToInsert.push({
          org_id: submission.org_id,
          deal_id: dealId,
          category: `service:${slugify(service)}`,
          label: `${labelPrefix} — ${service}`,
          file: toDealResourceFile(photo),
          visibility: "internal",
          mime_kind: inferMimeKind(photo.mime_type ?? photo.type ?? ""),
          source: "project_brief",
          submitted_by_form: submission.id,
        });
      }
    }
  };

  insertServicePhotoMap("service_before_photos", "Antes");
  insertServicePhotoMap("service_after_photos", "Después");

  for (const photo of readUploadedFiles(answers.team_photos_files)) {
    resourcesToInsert.push({
      org_id: submission.org_id,
      deal_id: dealId,
      category: "team",
      label: photo.original_name ?? photo.name ?? "Team photo",
      file: toDealResourceFile(photo),
      visibility: "internal",
      mime_kind: inferMimeKind(photo.mime_type ?? photo.type ?? ""),
      source: "project_brief",
      submitted_by_form: submission.id,
    });
  }

  if (resourcesToInsert.length === 0) return;

  const { error } = await supabase.from("deal_resources").insert(resourcesToInsert);
  if (error) {
    console.error("[processProjectBriefSubmission] insert failed", error);
  }
}
