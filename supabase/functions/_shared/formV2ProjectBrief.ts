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

export type BriefResourceInsert = {
  org_id: number;
  deal_id: number;
  category: string;
  label: string;
  file: {
    title: string;
    type: string;
    path: string;
    src: string;
    bucket?: string;
  };
  visibility: string;
  mime_kind: string;
  source: string;
  submitted_by_form?: number | null;
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

export const readUploadedFiles = (value: unknown): UploadedAnswerFile[] => {
  if (value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '""') return [];
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is UploadedAnswerFile =>
        Boolean(entry) && typeof entry === "object",
    );
  }
  if (typeof value === "object") {
    const file = value as UploadedAnswerFile;
    if (!file.path && !file.url) return [];
    return [file];
  }
  return [];
};

export const buildBriefResourceRows = (
  orgId: number,
  dealId: number,
  answers: Record<string, unknown>,
  options?: {
    source?: string;
    submittedByForm?: number | null;
  },
): BriefResourceInsert[] => {
  const source = options?.source ?? "project_brief";
  const submittedByForm = options?.submittedByForm ?? null;
  const resources: BriefResourceInsert[] = [];

  const pushFile = (
    file: UploadedAnswerFile,
    category: string,
    label: string,
  ) => {
    if (!file.path && !file.url) return;
    resources.push({
      org_id: orgId,
      deal_id: dealId,
      category,
      label,
      file: toDealResourceFile(file),
      visibility: "internal",
      mime_kind: inferMimeKind(file.mime_type ?? file.type ?? ""),
      source,
      submitted_by_form: submittedByForm,
    });
  };

  for (const logo of readUploadedFiles(answers.logo_file)) {
    pushFile(logo, "logo", logo.original_name ?? logo.name ?? "Logo");
  }

  const servicePhotos =
    answers.service_project_photos &&
    typeof answers.service_project_photos === "object" &&
    !Array.isArray(answers.service_project_photos)
      ? (answers.service_project_photos as Record<string, UploadedAnswerFile[]>)
      : {};

  for (const [service, photos] of Object.entries(servicePhotos)) {
    for (const photo of photos ?? []) {
      pushFile(
        photo,
        `service:${slugify(service)}`,
        photo.original_name ?? photo.name ?? service,
      );
    }
  }

  const insertServicePhotoMap = (answerKey: string, labelPrefix: string) => {
    const map =
      answers[answerKey] &&
      typeof answers[answerKey] === "object" &&
      !Array.isArray(answers[answerKey])
        ? (answers[answerKey] as Record<string, UploadedAnswerFile[]>)
        : {};

    for (const [service, photos] of Object.entries(map)) {
      for (const photo of photos ?? []) {
        pushFile(
          photo,
          `service:${slugify(service)}`,
          `${labelPrefix} — ${service}`,
        );
      }
    }
  };

  insertServicePhotoMap("service_before_photos", "Before");
  insertServicePhotoMap("service_after_photos", "After");

  for (const photo of readUploadedFiles(answers.team_photos_files)) {
    pushFile(photo, "team", photo.original_name ?? photo.name ?? "Team photo");
  }

  return resources;
};

export async function syncBriefAssetsToDealResources(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    dealId: number;
    answers: Record<string, unknown>;
    source?: string;
    submittedByForm?: number | null;
  },
) {
  const resourcesToInsert = buildBriefResourceRows(
    params.orgId,
    params.dealId,
    params.answers,
    {
      source: params.source,
      submittedByForm: params.submittedByForm,
    },
  );

  if (resourcesToInsert.length === 0) return { inserted: 0 };

  const { data: existing = [], error: existingError } = await supabase
    .from("deal_resources")
    .select("file")
    .eq("deal_id", params.dealId)
    .eq("source", params.source ?? "project_brief");

  if (existingError) {
    console.error(
      "[syncBriefAssetsToDealResources] lookup failed",
      existingError,
    );
    return { inserted: 0, error: existingError.message };
  }

  const existingPaths = new Set(
    existing
      .map((row) => {
        const file = row.file as { path?: string } | null;
        return file?.path?.trim() ?? "";
      })
      .filter(Boolean),
  );

  const newResources = resourcesToInsert.filter((resource) => {
    const path = resource.file.path?.trim();
    return path && !existingPaths.has(path);
  });

  if (newResources.length === 0) return { inserted: 0 };

  const { error } = await supabase.from("deal_resources").insert(newResources);
  if (error) {
    console.error("[syncBriefAssetsToDealResources] insert failed", error);
    return { inserted: 0, error: error.message };
  }

  return { inserted: newResources.length };
}

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
  if (!dealId) return { inserted: 0 };

  return syncBriefAssetsToDealResources(supabase, {
    orgId: submission.org_id,
    dealId,
    answers,
    source: "project_brief",
    submittedByForm: submission.id,
  });
}
