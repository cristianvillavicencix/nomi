import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SERVICE_CATEGORY_PREFIX = "service:";

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
    const slug = parseServiceCategorySlug(resource.category);
    if (!slug) continue;
    labels.set(slug, formatServiceCategoryLabel(slug));
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
  return services.length > 0 ? { services } : {};
}
