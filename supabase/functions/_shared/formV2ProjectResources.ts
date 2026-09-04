import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type UploadedAnswerFile = {
  resource_id?: number | string;
  name?: string;
  original_name?: string;
  url?: string;
  path?: string;
  bucket?: string;
  size?: number;
  type?: string;
  mime_type?: string;
};

type RequestScope = {
  sections?: string[];
  presetServices?: string[];
};

type DesiredResource = {
  resource_id?: number;
  label: string;
  file: UploadedAnswerFile;
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

const readResourceId = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const isUploadedFile = (value: unknown): value is UploadedAnswerFile =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (typeof (value as UploadedAnswerFile).url === "string" ||
        typeof (value as UploadedAnswerFile).path === "string" ||
        readResourceId((value as UploadedAnswerFile).resource_id) != null),
  );

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

const resolveServiceNames = (
  answers: Record<string, unknown>,
  requestScope?: RequestScope | null,
) => {
  const fromAnswers = Array.isArray(answers.services)
    ? (answers.services as unknown[])
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
    : [];
  if (fromAnswers.length > 0) return fromAnswers;

  const presets = Array.isArray(requestScope?.presetServices)
    ? requestScope!.presetServices!
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
    : [];
  return presets;
};

const resolveSyncFlags = (
  answers: Record<string, unknown>,
  requestScope?: RequestScope | null,
) => {
  const sections = Array.isArray(requestScope?.sections)
    ? requestScope!.sections!.map((entry) => String(entry))
    : [];
  const hasScope = sections.length > 0;
  const serviceSlugsFromScope = sections
    .filter((entry) => entry.startsWith("service:"))
    .map((entry) => entry.slice("service:".length));

  return {
    syncLogo: hasScope ? sections.includes("logo") : "logos" in answers,
    syncTeam: hasScope ? sections.includes("team") : "team_photos" in answers,
    syncServicePhotos: hasScope
      ? sections.includes("services") || serviceSlugsFromScope.length > 0
      : "service_photos" in answers,
    // Only sync before/after when the client actually sent that field (or
    // explicit "other" / before-after request scope), so a team-only /
    // single-service photo link cannot wipe existing pairs.
    syncBeforeAfter: hasScope
      ? sections.includes("other") ||
        ("before_after_photos" in answers &&
          (sections.includes("services") ||
            serviceSlugsFromScope.length > 0))
      : "before_after_photos" in answers,
    serviceSlugsFromScope,
    scopedServiceOnly:
      hasScope &&
      !sections.includes("services") &&
      serviceSlugsFromScope.length > 0,
  };
};

async function syncCategoryResources(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    dealId: number;
    submissionId: number;
    category: string;
    desired: DesiredResource[];
  },
) {
  const { orgId, dealId, submissionId, category, desired } = params;

  const { data: existingRows, error: existingError } = await supabase
    .from("deal_resources")
    .select("id, label")
    .eq("deal_id", dealId)
    .eq("category", category);

  if (existingError) {
    console.error(
      "[processProjectResourcesSubmission] load existing failed",
      category,
      existingError,
    );
    return;
  }

  const existingIds = new Set(
    (existingRows ?? []).map((row) => Number(row.id)).filter(Number.isFinite),
  );
  const keepIds = new Set<number>();
  const toInsert: Array<Record<string, unknown>> = [];

  for (const item of desired) {
    const resourceId = item.resource_id;
    if (resourceId != null && existingIds.has(resourceId)) {
      keepIds.add(resourceId);
      const current = (existingRows ?? []).find(
        (row) => Number(row.id) === resourceId,
      );
      if (current && String(current.label ?? "") !== item.label) {
        const { error } = await supabase
          .from("deal_resources")
          .update({ label: item.label })
          .eq("id", resourceId)
          .eq("deal_id", dealId);
        if (error) {
          console.error(
            "[processProjectResourcesSubmission] label update failed",
            error,
          );
        }
      }
      continue;
    }

    toInsert.push({
      org_id: orgId,
      deal_id: dealId,
      category,
      label: item.label,
      file: toDealResourceFile(item.file),
      visibility: "internal",
      mime_kind: inferMimeKind(item.file.mime_type ?? item.file.type ?? ""),
      source: "project_resources_wizard",
      submitted_by_form: submissionId,
    });
  }

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("deal_resources")
      .delete()
      .eq("deal_id", dealId)
      .eq("category", category)
      .in("id", toDelete);
    if (error) {
      console.error(
        "[processProjectResourcesSubmission] delete failed",
        category,
        error,
      );
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("deal_resources").insert(toInsert);
    if (error) {
      console.error(
        "[processProjectResourcesSubmission] insert failed",
        category,
        error,
      );
    }
  }
}

const collectTeamDesired = (answers: Record<string, unknown>): DesiredResource[] => {
  const raw = Array.isArray(answers.team_photos) ? answers.team_photos : [];
  const desired: DesiredResource[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    if ("file" in entry) {
      const record = entry as {
        person_name?: string;
        person_role?: string;
        file?: UploadedAnswerFile | null;
      };
      const photo = record.file;
      if (!isUploadedFile(photo)) continue;
      const name = String(record.person_name ?? "").trim();
      const role = String(record.person_role ?? "").trim();
      const label =
        name && role
          ? `${name} — ${role}`
          : name ||
            role ||
            photo.original_name ||
            photo.name ||
            "Team photo";
      desired.push({
        resource_id: readResourceId(photo.resource_id),
        label,
        file: photo,
      });
      continue;
    }

    if (isUploadedFile(entry)) {
      desired.push({
        resource_id: readResourceId(entry.resource_id),
        label: entry.original_name ?? entry.name ?? "Team photo",
        file: entry,
      });
    }
  }

  return desired;
};

const collectLogoDesired = (answers: Record<string, unknown>): DesiredResource[] => {
  const logos = Array.isArray(answers.logos) ? answers.logos : [];
  const desired: DesiredResource[] = [];
  for (const logo of logos) {
    if (!isUploadedFile(logo)) continue;
    desired.push({
      resource_id: readResourceId(logo.resource_id),
      label: logo.original_name ?? logo.name ?? "Logo",
      file: logo,
    });
  }
  return desired;
};

export async function processProjectResourcesSubmission(
  supabase: SupabaseClient,
  submission: {
    id: number;
    org_id: number;
    deal_id?: number | null;
  },
  answers: Record<string, unknown>,
  requestScope?: RequestScope | null,
) {
  const dealId = submission.deal_id;
  if (!dealId) return;

  const services = resolveServiceNames(answers, requestScope);
  const flags = resolveSyncFlags(answers, requestScope);

  const servicePhotos =
    answers.service_photos &&
    typeof answers.service_photos === "object" &&
    !Array.isArray(answers.service_photos)
      ? (answers.service_photos as Record<string, unknown>)
      : {};

  const mergeServicesIntoBrief = async () => {
    if (services.length === 0) return;

    const { data: deal } = await supabase
      .from("deals")
      .select("website_brief")
      .eq("id", dealId)
      .maybeSingle();

    const brief =
      deal?.website_brief && typeof deal.website_brief === "object"
        ? { ...(deal.website_brief as Record<string, unknown>) }
        : {};

    const existingRaw = brief.services_offered;
    const existing = Array.isArray(existingRaw)
      ? existingRaw.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : String(existingRaw ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);

    const merged = [...existing];
    for (const service of services) {
      if (
        !merged.some(
          (entry) => entry.toLowerCase() === service.toLowerCase(),
        )
      ) {
        merged.push(service);
      }
    }

    if (merged.length === existing.length) return;

    const { error } = await supabase
      .from("deals")
      .update({
        website_brief: {
          ...brief,
          services_offered: merged,
        },
      })
      .eq("id", dealId);

    if (error) {
      console.error(
        "[processProjectResourcesSubmission] brief services merge failed",
        error,
      );
    }
  };

  await mergeServicesIntoBrief();

  if (flags.syncLogo) {
    await syncCategoryResources(supabase, {
      orgId: submission.org_id,
      dealId,
      submissionId: submission.id,
      category: "logo",
      desired: collectLogoDesired(answers),
    });
  }

  if (flags.syncTeam) {
    await syncCategoryResources(supabase, {
      orgId: submission.org_id,
      dealId,
      submissionId: submission.id,
      category: "team",
      desired: collectTeamDesired(answers),
    });
  }

  if (flags.syncServicePhotos) {
    const servicesToSync = flags.scopedServiceOnly
      ? services.filter((service) =>
          flags.serviceSlugsFromScope.includes(slugify(service)),
        )
      : services;

    // Also include keys present in service_photos answers.
    const answerServiceKeys = Object.keys(servicePhotos);
    const allServices = [
      ...new Set([...servicesToSync, ...answerServiceKeys]),
    ].filter((service) => {
      if (!flags.scopedServiceOnly) return true;
      return flags.serviceSlugsFromScope.includes(slugify(service));
    });

    for (const service of allServices) {
      const photos = Array.isArray(servicePhotos[service])
        ? (servicePhotos[service] as unknown[])
        : [];
      const desired: DesiredResource[] = [];
      for (const photo of photos) {
        if (!isUploadedFile(photo)) continue;
        desired.push({
          resource_id: readResourceId(photo.resource_id),
          label: photo.original_name ?? photo.name ?? service,
          file: photo,
        });
      }
      await syncCategoryResources(supabase, {
        orgId: submission.org_id,
        dealId,
        submissionId: submission.id,
        category: `service:${slugify(service)}`,
        desired,
      });
    }
  }

  if (flags.syncBeforeAfter) {
    const beforeAfterRaw = answers.before_after_photos;
    const beforeAfterRecord =
      beforeAfterRaw &&
      typeof beforeAfterRaw === "object" &&
      !Array.isArray(beforeAfterRaw)
        ? (beforeAfterRaw as {
            selected?: unknown;
            services?: Record<
              string,
              {
                pairs?: Array<{
                  description?: string;
                  before?: UploadedAnswerFile | null;
                  after?: UploadedAnswerFile | null;
                }>;
                description?: string;
                before?: UploadedAnswerFile[];
                after?: UploadedAnswerFile[];
              }
            >;
          })
        : { selected: [], services: {} };

    const selectedServices = Array.isArray(beforeAfterRecord.selected)
      ? beforeAfterRecord.selected
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean)
      : [];
    const serviceEntries = beforeAfterRecord.services ?? {};

    type PairLike = {
      description?: string;
      before?: UploadedAnswerFile | null;
      after?: UploadedAnswerFile | null;
    };

    const readPairs = (entry: {
      pairs?: PairLike[];
      description?: string;
      before?: UploadedAnswerFile[];
      after?: UploadedAnswerFile[];
    }): PairLike[] => {
      if (Array.isArray(entry.pairs) && entry.pairs.length > 0) {
        return entry.pairs;
      }
      const beforePhotos = Array.isArray(entry.before) ? entry.before : [];
      const afterPhotos = Array.isArray(entry.after) ? entry.after : [];
      const count = Math.max(beforePhotos.length, afterPhotos.length);
      if (count === 0) return [];
      const sharedDescription = String(entry.description ?? "").trim();
      return Array.from({ length: count }, (_, index) => ({
        description: index === 0 ? sharedDescription : "",
        before: beforePhotos[index] ?? null,
        after: afterPhotos[index] ?? null,
      }));
    };

    const servicesForBeforeAfter = (
      selectedServices.length > 0 ? selectedServices : services
    ).filter((service) => {
      if (!flags.scopedServiceOnly) return true;
      return flags.serviceSlugsFromScope.includes(slugify(service));
    });

    // Include services that have entries even if not selected (prefill reopen).
    for (const key of Object.keys(serviceEntries)) {
      if (!servicesForBeforeAfter.includes(key)) {
        if (
          flags.scopedServiceOnly &&
          !flags.serviceSlugsFromScope.includes(slugify(key))
        ) {
          continue;
        }
        servicesForBeforeAfter.push(key);
      }
    }

    for (const service of servicesForBeforeAfter) {
      const entry = serviceEntries[service];
      const category = `before-after:${slugify(service)}`;
      const pairs = entry && typeof entry === "object" ? readPairs(entry) : [];
      const desired: DesiredResource[] = [];

      for (const pair of pairs) {
        const description = String(pair.description ?? "").trim();
        const beforePhoto = pair.before ?? null;
        const afterPhoto = pair.after ?? null;

        if (isUploadedFile(beforePhoto)) {
          desired.push({
            resource_id: readResourceId(beforePhoto.resource_id),
            label: description ? `Before — ${description}` : "Before",
            file: beforePhoto,
          });
        }
        if (isUploadedFile(afterPhoto)) {
          desired.push({
            resource_id: readResourceId(afterPhoto.resource_id),
            label: description ? `After — ${description}` : "After",
            file: afterPhoto,
          });
        }
      }

      await syncCategoryResources(supabase, {
        orgId: submission.org_id,
        dealId,
        submissionId: submission.id,
        category,
        desired,
      });
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
