import { slugifyServiceName } from "@/lbs/deals/projectResourceConstants";

/** Service tab slugs from submitted website_brief (shows empty tabs for missing photos). */
export const serviceSlugsFromBrief = (
  brief?: Record<string, unknown> | null,
): string[] => {
  const offered = brief?.services_offered;
  if (!offered) return [];

  const names = Array.isArray(offered)
    ? offered.map(String)
    : String(offered)
        .split(",")
        .map((entry) => entry.trim());

  return names.filter(Boolean).map((name) => slugifyServiceName(name));
};
