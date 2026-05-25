import {
  buildServiceCategory,
  parseServiceCategorySlug,
} from "@/lbs/deals/projectResourceConstants";

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

export const FULL_RESOURCE_REQUEST: ResourceRequestScope = {
  sections: ["logo", "team", "services"],
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
  next.searchParams.set(
    "sections",
    buildRequestSectionsParam(scope.sections),
  );
  if (scope.presetServices?.length) {
    next.searchParams.set("services", scope.presetServices.join("|"));
  }
  return next.toString();
};

export const scopeForResourceTab = (
  tabId: string,
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
    return { sections: ["services"] };
  }
  const serviceSlug = parseServiceCategorySlug(tabId);
  if (serviceSlug) {
    const label = serviceSlug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return {
      sections: [`service:${serviceSlug}` as ResourceRequestSection],
      presetServices: [label],
    };
  }
  return FULL_RESOURCE_REQUEST;
};

export const scopeForNewServiceTab = (serviceName: string): ResourceRequestScope => {
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
      ?.split("|")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];
  return { sections, presetServices };
};

export const filterProjectResourcesSchema = (
  schema: { sections?: Array<{ id: string }>; settings?: Record<string, unknown> } | undefined,
  sections: ResourceRequestSection[] | null,
) => {
  if (!schema || !sections?.length) return schema;
  return {
    ...schema,
    sections: (schema.sections ?? []).filter((section) =>
      shouldShowProjectResourcesSection(section.id, sections),
    ),
  };
};

export const shouldShowProjectResourcesSection = (
  sectionId: string,
  sections: ResourceRequestSection[] | null,
) => {
  if (!sections?.length) return true;
  if (sectionId === "company_info") return true;
  if (sectionId === "logos") {
    return sections.includes("logo");
  }
  if (sectionId === "team") {
    return sections.includes("team");
  }
  if (sectionId === "services") {
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
