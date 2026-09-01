export const CATALOG_CATEGORIES = [
  { value: "web", label: "Web" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "seo", label: "SEO" },
  { value: "hosting", label: "Hosting & maintenance" },
  { value: "skop", label: "SKOP" },
  { value: "tickets", label: "Tickets & deliverables" },
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
  {
    key: "tickets",
    label: "Tickets & deliverables",
    categories: ["tickets"] as const,
  },
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

/** Catalog list filter keys — `group:*` for category groups, `usage:*` for Book now / Tickets. */
export type CatalogListFilterKey =
  | "all"
  | `group:${(typeof ADDON_CATALOG_GROUPS)[number]["key"]}`
  | "usage:book_now"
  | "usage:tickets";

type CatalogRowLike = {
  name: string;
  description?: string | null;
  category?: string | null;
  booking_enabled?: boolean | null;
  ticket_billing_enabled?: boolean | null;
};

const catalogGroup = (filterKey: CatalogListFilterKey) => {
  if (!filterKey.startsWith("group:")) return null;
  const key = filterKey.slice("group:".length);
  return ADDON_CATALOG_GROUPS.find((entry) => entry.key === key) ?? null;
};

export const catalogRowMatchesFilter = (
  row: CatalogRowLike,
  filterKey: CatalogListFilterKey,
) => {
  if (filterKey === "all") return true;
  if (filterKey === "usage:book_now") return row.booking_enabled === true;
  if (filterKey === "usage:tickets") return row.ticket_billing_enabled === true;
  const group = catalogGroup(filterKey);
  if (!group) return true;
  return group.categories.includes(
    (row.category ?? "") as (typeof group.categories)[number],
  );
};

export const filterCatalogPackages = <T extends CatalogRowLike>(
  rows: T[],
  filterKey: CatalogListFilterKey,
  search: string,
): T[] => {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (!catalogRowMatchesFilter(row, filterKey)) return false;
    if (!query) return true;
    return (
      row.name.toLowerCase().includes(query) ||
      (row.description ?? "").toLowerCase().includes(query) ||
      categoryLabel(row.category).toLowerCase().includes(query)
    );
  });
};

export const catalogFilterOptionsForRows = (
  rows: CatalogRowLike[],
  options?: { includeUsageFilters?: boolean },
) => {
  const includeUsageFilters = options?.includeUsageFilters ?? true;
  const chips: { key: CatalogListFilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
  ];

  for (const group of ADDON_CATALOG_GROUPS) {
    const count = rows.filter((row) =>
      group.categories.includes(
        (row.category ?? "") as (typeof group.categories)[number],
      ),
    ).length;
    if (count > 0) {
      chips.push({
        key: `group:${group.key}`,
        label: group.label,
        count,
      });
    }
  }

  if (includeUsageFilters) {
    const bookNowCount = rows.filter((row) => row.booking_enabled).length;
    if (bookNowCount > 0) {
      chips.push({
        key: "usage:book_now",
        label: "Book now",
        count: bookNowCount,
      });
    }
    const ticketsCount = rows.filter(
      (row) => row.ticket_billing_enabled,
    ).length;
    if (ticketsCount > 0) {
      chips.push({
        key: "usage:tickets",
        label: "Tickets",
        count: ticketsCount,
      });
    }
  }

  return chips;
};
