import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveStorageDisplayUrl } from "./storageObjectUrl.ts";

const SERVICE_CATEGORY_PREFIX = "service:";
const BEFORE_AFTER_CATEGORY_PREFIX = "before-after:";

type DealResourceRow = {
  id: number;
  category: string;
  label?: string | null;
  file?: {
    title?: string;
    type?: string;
    path?: string;
    src?: string;
    bucket?: string;
  } | null;
  created_at?: string | null;
};

type PrefillFile = {
  resource_id: number;
  name: string;
  original_name: string;
  url: string;
  path: string;
  bucket: string;
  type: string;
  mime_type: string;
  size: number;
};

const slugifyServiceName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "service";

const parseServiceCategorySlug = (category?: string | null) => {
  if (!category?.startsWith(SERVICE_CATEGORY_PREFIX)) return null;
  return category.slice(SERVICE_CATEGORY_PREFIX.length);
};

const parseBeforeAfterCategorySlug = (category?: string | null) => {
  if (!category?.startsWith(BEFORE_AFTER_CATEGORY_PREFIX)) return null;
  return category.slice(BEFORE_AFTER_CATEGORY_PREFIX.length);
};

const formatServiceCategoryLabel = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const readServiceNamesFromBrief = (
  brief?: Record<string, unknown> | null,
): string[] => {
  const offered = brief?.services_offered;
  if (!offered) return [];

  const names = Array.isArray(offered)
    ? offered.map(String)
    : String(offered)
        .split(",")
        .map((entry) => entry.trim());

  return names.filter(Boolean);
};

const parseTeamLabel = (label?: string | null) => {
  const raw = String(label ?? "").trim();
  if (!raw) return { person_name: "", person_role: "" };
  const separator = " — ";
  const index = raw.indexOf(separator);
  if (index === -1) return { person_name: raw, person_role: "" };
  return {
    person_name: raw.slice(0, index).trim(),
    person_role: raw.slice(index + separator.length).trim(),
  };
};

const parseBeforeAfterLabel = (label?: string | null) => {
  const raw = String(label ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("before")) {
    const description = raw.replace(/^before\s*[—–\-:]\s*/i, "").trim();
    return {
      type: "before" as const,
      description: description.toLowerCase() === "before" ? "" : description,
    };
  }
  if (lower.startsWith("after")) {
    const description = raw.replace(/^after\s*[—–\-:]\s*/i, "").trim();
    return {
      type: "after" as const,
      description: description.toLowerCase() === "after" ? "" : description,
    };
  }
  return { type: null as const, description: raw };
};

const resourceSortKey = (resource: DealResourceRow) =>
  String(resource.created_at ?? resource.id ?? "");

const toPrefillFile = async (
  supabase: SupabaseClient,
  resource: DealResourceRow,
): Promise<PrefillFile | null> => {
  const file = resource.file;
  if (!file || typeof file !== "object") return null;
  const path = String(file.path ?? "").trim();
  const bucket = String(file.bucket ?? "project-files").trim() || "project-files";
  const src = String(file.src ?? path).trim();
  if (!path && !src) return null;

  const url =
    (await resolveStorageDisplayUrl(supabase, src || path, {
      defaultBucket: bucket,
      expiresIn: 60 * 60 * 12,
    })) || src;

  const name = String(file.title ?? path.split("/").pop() ?? "Upload");
  const mime = String(file.type ?? "application/octet-stream");

  return {
    resource_id: Number(resource.id),
    name,
    original_name: name,
    url,
    path,
    bucket,
    type: mime,
    mime_type: mime,
    size: 0,
  };
};

const groupBeforeAfterIntoPairs = (items: DealResourceRow[]) => {
  const befores: Array<{ resource: DealResourceRow; description: string }> = [];
  const afters: Array<{ resource: DealResourceRow; description: string }> = [];

  for (const resource of items) {
    const parsed = parseBeforeAfterLabel(resource.label);
    if (parsed.type === "before") {
      befores.push({ resource, description: parsed.description });
    } else if (parsed.type === "after") {
      afters.push({ resource, description: parsed.description });
    }
  }

  befores.sort((a, b) =>
    resourceSortKey(a.resource).localeCompare(resourceSortKey(b.resource)),
  );
  afters.sort((a, b) =>
    resourceSortKey(a.resource).localeCompare(resourceSortKey(b.resource)),
  );

  const pairs: Array<{
    description: string;
    before: DealResourceRow | null;
    after: DealResourceRow | null;
  }> = [];
  const usedAfterIds = new Set<number>();

  for (const before of befores) {
    const matchIndex = afters.findIndex(
      (after) =>
        !usedAfterIds.has(Number(after.resource.id)) &&
        after.description === before.description &&
        before.description !== "",
    );
    if (matchIndex >= 0) {
      const after = afters[matchIndex];
      usedAfterIds.add(Number(after.resource.id));
      pairs.push({
        description: before.description,
        before: before.resource,
        after: after.resource,
      });
      continue;
    }
    pairs.push({
      description: before.description,
      before: before.resource,
      after: null,
    });
  }

  const unmatchedAfters = afters.filter(
    (after) => !usedAfterIds.has(Number(after.resource.id)),
  );
  let afterCursor = 0;
  for (const pair of pairs) {
    if (pair.after || !pair.before || pair.description) continue;
    const nextAfter = unmatchedAfters[afterCursor];
    if (!nextAfter) break;
    pair.after = nextAfter.resource;
    pair.description = nextAfter.description;
    usedAfterIds.add(Number(nextAfter.resource.id));
    afterCursor += 1;
  }

  for (let index = afterCursor; index < unmatchedAfters.length; index += 1) {
    const after = unmatchedAfters[index];
    pairs.push({
      description: after.description,
      before: null,
      after: after.resource,
    });
  }

  return pairs;
};

/** Prefill wizard `services` from existing project tabs (brief + uploaded resources). */
export async function buildProjectResourcesServicesPrefill(
  supabase: SupabaseClient,
  dealId: number,
  websiteBrief?: Record<string, unknown> | null,
): Promise<string[]> {
  const labels = new Map<string, string>();

  for (const name of readServiceNamesFromBrief(websiteBrief)) {
    const slug = slugifyServiceName(name);
    labels.set(slug, name.trim());
  }

  const { data: resources } = await supabase
    .from("deal_resources")
    .select("category")
    .eq("deal_id", dealId);

  for (const resource of resources ?? []) {
    const serviceSlug = parseServiceCategorySlug(resource.category);
    if (serviceSlug) {
      labels.set(serviceSlug, formatServiceCategoryLabel(serviceSlug));
      continue;
    }
    const beforeAfterSlug = parseBeforeAfterCategorySlug(resource.category);
    if (beforeAfterSlug) {
      labels.set(beforeAfterSlug, formatServiceCategoryLabel(beforeAfterSlug));
    }
  }

  return Array.from(labels.values()).sort((left, right) =>
    left.localeCompare(right),
  );
}

export async function buildProjectResourcesPrefill(
  supabase: SupabaseClient,
  dealId: number,
  websiteBrief?: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  const services = await buildProjectResourcesServicesPrefill(
    supabase,
    dealId,
    websiteBrief,
  );

  const { data: resources } = await supabase
    .from("deal_resources")
    .select("id, category, label, file, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  const rows = (resources ?? []) as DealResourceRow[];
  const prefill: Record<string, unknown> = {};
  if (services.length > 0) prefill.services = services;

  const logos: PrefillFile[] = [];
  const teamPhotos: Array<{
    id: string;
    person_name: string;
    person_role: string;
    file: PrefillFile;
  }> = [];
  const servicePhotos: Record<string, PrefillFile[]> = {};
  const beforeAfterBySlug: Record<string, DealResourceRow[]> = {};

  const serviceLabelBySlug = new Map(
    services.map((name) => [slugifyServiceName(name), name]),
  );

  for (const resource of rows) {
    const file = await toPrefillFile(supabase, resource);
    if (!file) continue;

    if (resource.category === "logo") {
      logos.push(file);
      continue;
    }

    if (resource.category === "team") {
      const parsed = parseTeamLabel(resource.label);
      teamPhotos.push({
        id: `team-${resource.id}`,
        person_name: parsed.person_name,
        person_role: parsed.person_role,
        file,
      });
      continue;
    }

    const serviceSlug = parseServiceCategorySlug(resource.category);
    if (serviceSlug) {
      const label =
        serviceLabelBySlug.get(serviceSlug) ??
        formatServiceCategoryLabel(serviceSlug);
      serviceLabelBySlug.set(serviceSlug, label);
      if (!servicePhotos[label]) servicePhotos[label] = [];
      servicePhotos[label].push(file);
      continue;
    }

    const beforeAfterSlug = parseBeforeAfterCategorySlug(resource.category);
    if (beforeAfterSlug) {
      if (!beforeAfterBySlug[beforeAfterSlug]) {
        beforeAfterBySlug[beforeAfterSlug] = [];
      }
      beforeAfterBySlug[beforeAfterSlug].push(resource);
    }
  }

  if (logos.length > 0) prefill.logos = logos;
  if (teamPhotos.length > 0) prefill.team_photos = teamPhotos;
  if (Object.keys(servicePhotos).length > 0) {
    prefill.service_photos = servicePhotos;
  }

  const beforeAfterServices: Record<
    string,
    {
      pairs: Array<{
        id: string;
        description: string;
        before: PrefillFile | null;
        after: PrefillFile | null;
      }>;
    }
  > = {};
  const selected: string[] = [];

  for (const [slug, items] of Object.entries(beforeAfterBySlug)) {
    const label =
      serviceLabelBySlug.get(slug) ?? formatServiceCategoryLabel(slug);
    const pairs = groupBeforeAfterIntoPairs(items);
    const mappedPairs = [];
    for (const pair of pairs) {
      const before = pair.before
        ? await toPrefillFile(supabase, pair.before)
        : null;
      const after = pair.after
        ? await toPrefillFile(supabase, pair.after)
        : null;
      mappedPairs.push({
        id: `pair-${pair.before?.id ?? "x"}-${pair.after?.id ?? "y"}`,
        description: pair.description,
        before,
        after,
      });
    }
    if (mappedPairs.length === 0) continue;
    beforeAfterServices[label] = { pairs: mappedPairs };
    selected.push(label);
  }

  if (selected.length > 0) {
    prefill.before_after_photos = {
      selected,
      services: beforeAfterServices,
    };
  }

  // Ensure services list includes labels referenced by photos / before-after.
  const allServiceLabels = new Set<string>([
    ...services,
    ...Object.keys(servicePhotos),
    ...selected,
  ]);
  if (allServiceLabels.size > 0) {
    prefill.services = Array.from(allServiceLabels).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  return prefill;
}
