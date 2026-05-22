export const PROJECT_RESOURCES_SLUG = "project-resources";

export type ProjectResourceTabCategory =
  | "logo"
  | "service-photo"
  | "team"
  | "document"
  | "other";

/** Legacy values still stored on older records. */
export type LegacyProjectResourceCategory = "location" | "brand";

export type ProjectResourceCategory =
  | ProjectResourceTabCategory
  | LegacyProjectResourceCategory;

export const PROJECT_RESOURCE_TAB_CATEGORIES: Array<{
  id: ProjectResourceTabCategory;
  label: string;
  description: string;
  clientLabel: string;
}> = [
  {
    id: "logo",
    label: "Logos",
    description: "Primary and alternate logo files.",
    clientLabel: "Upload your logo files",
  },
  {
    id: "service-photo",
    label: "Photo services",
    description: "Photos for each service you offer.",
    clientLabel: "Photos of your services",
  },
  {
    id: "team",
    label: "Team",
    description: "Headshots and team photos.",
    clientLabel: "Team and staff photos",
  },
  {
    id: "document",
    label: "Documents",
    description: "PDFs, briefs, contracts, and other project files.",
    clientLabel: "Documents and PDFs",
  },
  {
    id: "other",
    label: "Other",
    description: "Anything else useful for the project.",
    clientLabel: "Other helpful images",
  },
];

/** @deprecated Use PROJECT_RESOURCE_TAB_CATEGORIES */
export const PROJECT_RESOURCE_CATEGORIES = PROJECT_RESOURCE_TAB_CATEGORIES;

const LEGACY_CATEGORY_LABELS: Record<LegacyProjectResourceCategory, string> = {
  location: "Location & facility",
  brand: "Brand assets",
};

export const isProjectResourceTabCategory = (
  category: string,
): category is ProjectResourceTabCategory =>
  PROJECT_RESOURCE_TAB_CATEGORIES.some((entry) => entry.id === category);

export const getResourceTabCategory = (
  category?: string | null,
): ProjectResourceTabCategory => {
  if (category && isProjectResourceTabCategory(category)) {
    return category;
  }
  return "other";
};

export const getProjectResourceCategoryLabel = (category: string) =>
  PROJECT_RESOURCE_TAB_CATEGORIES.find((entry) => entry.id === category)?.label ??
  LEGACY_CATEGORY_LABELS[category as LegacyProjectResourceCategory] ??
  category.replace(/-/g, " ");

export type ProjectResourceFile = {
  title: string;
  type: string;
  path: string;
  src: string;
};

export type ProjectResourceUploadItem = {
  category: ProjectResourceCategory;
  label?: string;
  name: string;
  content: string;
  content_type?: string;
};

export type ProjectResourcesLinkParams = {
  dealId: string | number;
  companyId?: string | number | null;
  contactId?: string | number | null;
};

export const buildProjectResourcesUrl = (
  origin: string,
  { dealId, companyId, contactId }: ProjectResourcesLinkParams,
) => {
  const url = new URL(
    `${origin.replace(/\/$/, "")}/forms/${PROJECT_RESOURCES_SLUG}`,
  );
  url.searchParams.set("deal_id", String(dealId));
  if (companyId != null && String(companyId).trim()) {
    url.searchParams.set("company_id", String(companyId));
  }
  if (contactId != null && String(contactId).trim()) {
    url.searchParams.set("contact_id", String(contactId));
  }
  return url.toString();
};

export const isImageResource = (mimeType?: string) =>
  Boolean(mimeType?.startsWith("image/"));

export const fileToUploadItem = async (
  file: File,
  category: ProjectResourceCategory,
  label?: string,
): Promise<ProjectResourceUploadItem> => {
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  return {
    category,
    label: label?.trim() || undefined,
    name: file.name,
    content,
    content_type: file.type || "application/octet-stream",
  };
};
