export const CATALOG_CATEGORIES = [
  { value: "web", label: "Web" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "seo", label: "SEO" },
  { value: "hosting", label: "Hosting & maintenance" },
  { value: "skop", label: "SKOP" },
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]["value"];

export const ADDON_CATALOG_GROUPS = [
  { key: "design", label: "Design & brand", categories: ["design"] as const },
  { key: "web", label: "Web — extras", categories: ["web"] as const },
  { key: "seo", label: "SEO & content", categories: ["seo"] as const },
  {
    key: "recurring",
    label: "Recurring (hosting & support)",
    categories: ["hosting"] as const,
  },
  { key: "skop", label: "SKOP", categories: ["skop"] as const },
] as const;

export const categoryLabel = (value?: string | null) =>
  CATALOG_CATEGORIES.find((entry) => entry.value === value)?.label ??
  value ??
  "Other";

export const billingTypeLabel = (billingType: "one_time" | "recurring") =>
  billingType === "recurring" ? "Recurring" : "One-time";

export const billingIntervalSuffix = (
  billingType: "one_time" | "recurring",
  interval?: string | null,
) => {
  if (billingType !== "recurring") return "";
  if (interval === "weekly") return "/wk";
  if (interval === "yearly") return "/yr";
  return "/mo";
};
