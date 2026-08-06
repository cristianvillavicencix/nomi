import {
  buildServiceCategory,
  formatServiceCategoryLabel,
  parseServiceCategorySlug,
} from "@/modules/deals/projectResourceConstants";

export type ResourceRequestSection =
  | "logo"
  | "team"
  | "document"
  | "other"
  | "services"
  | `service:${string}`;

export type ResourceRequestScope = {
  sections: ResourceRequestSection[];
  presetServices?: string[];
};

export type ResourceRequestServiceTab = {
  id: string;
  label: string;
  category: string;
};

export const FULL_RESOURCE_REQUEST: ResourceRequestScope = {
  sections: ["logo", "team", "services"],
};

/** Logo + team + service photos; skips the services list when tabs already exist. */
export const scopeForFullResourceRequest = (
  serviceTabs: ResourceRequestServiceTab[],
): ResourceRequestScope => {
  if (serviceTabs.length === 0) {
    return FULL_RESOURCE_REQUEST;
  }

  const photoScope = scopeForPhotoServicesRequest(serviceTabs);
  return {
    sections: ["logo", "team", ...photoScope.sections],
    presetServices: photoScope.presetServices,
  };
};

export const parseRequestSectionsParam = (
  value: string | null,
): ResourceRequestSection[] | null => {
  if (!value?.trim()) return null;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean) as ResourceRequestSection[];
};

export const buildRequestSectionsParam = (sections: ResourceRequestSection[]) =>
  sections.join(",");

export const appendRequestScopeToUrl = (
  url: string,
  scope: ResourceRequestScope,
) => {
  const next = new URL(url, window.location.origin);
  next.searchParams.set("sections", buildRequestSectionsParam(scope.sections));
  if (scope.presetServices?.length) {
    next.searchParams.set("services", scope.presetServices.join("| "));
  }
  return next.toString();
};

/** Request photos for all known project service tabs (skips the services list step). */
export const scopeForPhotoServicesRequest = (
  serviceTabs: ResourceRequestServiceTab[],
): ResourceRequestScope => {
  if (serviceTabs.length === 0) {
    return { sections: ["services"] };
  }

  const sections: ResourceRequestSection[] = [];
  const presetServices: string[] = [];

  for (const tab of serviceTabs) {
    const slug =
      parseServiceCategorySlug(tab.category) ??
      parseServiceCategorySlug(tab.id);
    if (!slug) continue;
    sections.push(`service:${slug}` as ResourceRequestSection);
    presetServices.push(tab.label.trim() || formatServiceCategoryLabel(slug));
  }

  if (sections.length === 0) {
    return { sections: ["services"] };
  }

  return { sections, presetServices };
};

export const scopeForResourceTab = (
  tabId: string,
  options?: { serviceTabs?: ResourceRequestServiceTab[] },
): ResourceRequestScope | typeof FULL_RESOURCE_REQUEST => {
  if (tabId === "logo") {
    return { sections: ["logo"] };
  }
  if (tabId === "team") {
    return { sections: ["team"] };
  }
  if (tabId === "document") {
    return { sections: ["document"] };
  }
  if (tabId === "other") {
    return { sections: ["other"] };
  }
  if (tabId === "service-photo") {
    return scopeForPhotoServicesRequest(options?.serviceTabs ?? []);
  }

  const serviceSlug = parseServiceCategorySlug(tabId);
  if (serviceSlug) {
    const matchingTab = options?.serviceTabs?.find(
      (tab) =>
        tab.id === tabId ||
        parseServiceCategorySlug(tab.category) === serviceSlug,
    );
    const label =
      matchingTab?.label?.trim() || formatServiceCategoryLabel(serviceSlug);
    return {
      sections: [`service:${serviceSlug}` as ResourceRequestSection],
      presetServices: [label],
    };
  }
  return FULL_RESOURCE_REQUEST;
};

export const scopeForNewServiceTab = (
  serviceName: string,
): ResourceRequestScope => {
  const category = buildServiceCategory(serviceName);
  const slug = parseServiceCategorySlug(category) ?? serviceName;
  return {
    sections: [`service:${slug}` as ResourceRequestSection],
    presetServices: [serviceName.trim()],
  };
};

export const readRequestScopeFromLocation = (): {
  sections: ResourceRequestSection[] | null;
  presetServices: string[];
} => {
  const params = new URLSearchParams(window.location.search);
  const sections = parseRequestSectionsParam(params.get("sections"));
  const presetServices =
    params
      .get("services")
      ?.split("| ")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];
  return { sections, presetServices };
};

export const buildPresetServicesAnswers = (
  presetServices: string[],
): Record<string, unknown> =>
  presetServices.length > 0 ? { services: [...presetServices] } : {};

export const filterProjectResourcesSchema = (
  schema:
    | { sections?: Array<{ id: string }>; settings?: Record<string, unknown> }
    | undefined,
  sections: ResourceRequestSection[] | null,
  presetServices?: string[],
) => {
  if (!schema || !sections?.length) return schema;
  return {
    ...schema,
    sections: (schema.sections ?? []).filter((section) =>
      shouldShowProjectResourcesSection(section.id, sections, presetServices),
    ),
  };
};

export const shouldShowProjectResourcesSection = (
  sectionId: string,
  sections: ResourceRequestSection[] | null,
  presetServices?: string[],
) => {
  if (!sections?.length) return true;

  const serviceOnlyScope =
    sections.length > 0 && sections.every((entry) => entry.startsWith("service:"));

  if (sectionId === "company_info") {
    if (serviceOnlyScope) return false;
    return true;
  }

  if (sectionId === "logos") {
    return sections.includes("logo");
  }
  if (sectionId === "team") {
    return sections.includes("team");
  }
  if (sectionId === "services") {
    if (presetServices?.length) {
      return false;
    }
    return sections.includes("services");
  }
  if (sectionId === "service_photos") {
    return (
      sections.includes("services") ||
      sections.some((entry) => entry.startsWith("service:"))
    );
  }
  return true;
};
