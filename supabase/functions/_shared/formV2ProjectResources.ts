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

export async function resolveProjectResourcesDealId(
  supabase: SupabaseClient,
  orgId: number,
  tokenDealId: number | null | undefined,
  answers: Record<string, unknown>,
): Promise<number | null> {
  if (tokenDealId != null && Number.isFinite(Number(tokenDealId))) {
    return Number(tokenDealId);
  }

  const mode = String(answers.project_link_mode ?? "").trim();
  if (mode === "existing") {
    const code = String(answers.project_code ?? "").trim();
    const dealId = Number(code);
    if (!Number.isFinite(dealId)) return null;

    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("org_id", orgId)
      .eq("id", dealId)
      .maybeSingle();

    return deal?.id ?? null;
  }

  return null;
}

export async function createProjectResourcesLeadDeal(
  supabase: SupabaseClient,
  orgId: number,
  answers: Record<string, unknown>,
  contactId?: number | null,
  companyId?: number | null,
): Promise<number | null> {
  const companyName = String(answers.company_name ?? "").trim();
  const { data: deal } = await supabase
    .from("deals")
    .insert({
      org_id: orgId,
      name: companyName || "New project resources submission",
      stage: "lead",
      contact_id: contactId ?? null,
      company_id: companyId ?? null,
    })
    .select("id")
    .single();

  return deal?.id ?? null;
}

export async function processProjectResourcesSubmission(
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

  const logos = Array.isArray(answers.logos)
    ? (answers.logos as UploadedAnswerFile[])
    : [];
  const services = Array.isArray(answers.services)
    ? (answers.services as unknown[])
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
    : [];
  const servicePhotos =
    answers.service_photos &&
    typeof answers.service_photos === "object" &&
    !Array.isArray(answers.service_photos)
      ? (answers.service_photos as Record<string, UploadedAnswerFile[]>)
      : {};

  const resourcesToInsert: Array<Record<string, unknown>> = [];

  for (const logo of logos) {
    resourcesToInsert.push({
      org_id: submission.org_id,
      deal_id: dealId,
      category: "logo",
      label: logo.original_name ?? logo.name ?? "Logo",
      file: toDealResourceFile(logo),
      visibility: "internal",
      mime_kind: inferMimeKind(logo.mime_type ?? logo.type ?? ""),
      source: "project_resources_wizard",
      submitted_by_form: submission.id,
    });
  }

  for (const service of services) {
    const photos = servicePhotos[service] ?? [];
    for (const photo of photos) {
      resourcesToInsert.push({
        org_id: submission.org_id,
        deal_id: dealId,
        category: `service:${slugify(service)}`,
        label: photo.original_name ?? photo.name ?? service,
        file: toDealResourceFile(photo),
        visibility: "internal",
        mime_kind: inferMimeKind(photo.mime_type ?? photo.type ?? ""),
        source: "project_resources_wizard",
        submitted_by_form: submission.id,
      });
    }
  }

  if (resourcesToInsert.length > 0) {
    const { error } = await supabase.from("deal_resources").insert(resourcesToInsert);
    if (error) {
      console.error("[processProjectResourcesSubmission] insert failed", error);
    }
  }

  const companyName = String(answers.company_name ?? "").trim();
  if (companyName) {
    await supabase
      .from("form_submissions_v2")
      .update({ submitter_name: companyName })
      .eq("id", submission.id);
  }
}
