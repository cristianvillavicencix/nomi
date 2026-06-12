import type { DataProvider, Identifier } from "ra-core";

export const LAUNCH_CHECKLIST_CATEGORIES = [
  { value: "seo", label: "SEO" },
  { value: "analytics", label: "Analytics" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "content", label: "Content" },
  { value: "legal", label: "Legal" },
  { value: "backup", label: "Backup" },
  { value: "other", label: "Other" },
] as const;

export const getLaunchChecklistCategoryLabel = (value: string) =>
  LAUNCH_CHECKLIST_CATEGORIES.find((item) => item.value === value)?.label ??
  value;

export const generateLaunchChecklistFromTemplate = async ({
  dataProvider,
  dealId,
  orgId,
  projectType,
}: {
  dataProvider: DataProvider;
  dealId: Identifier;
  orgId: Identifier;
  projectType?: string | null;
}) => {
  const normalizedType = projectType || "website";
  const { data: templates = [] } = await dataProvider.getList(
    "launch_checklist_templates",
    {
      filter: {
        "project_type@eq": normalizedType,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "order_index", order: "ASC" },
    },
  );

  const { data: existing = [] } = await dataProvider.getList(
    "deal_launch_checklist_items",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "order_index", order: "ASC" },
    },
  );

  const existingLabels = new Set(
    existing.map((item) => String(item.label).toLowerCase()),
  );

  let created = 0;
  for (const template of templates) {
    if (existingLabels.has(String(template.label).toLowerCase())) {
      continue;
    }
    await dataProvider.create("deal_launch_checklist_items", {
      data: {
        org_id: orgId,
        deal_id: dealId,
        category: template.category,
        label: template.label,
        description: template.description,
        is_required: template.is_required,
        is_completed: false,
        order_index: template.order_index,
      },
    });
    created += 1;
  }

  return created;
};

export const getLaunchChecklistProgress = (
  items: Array<{ is_required?: boolean; is_completed?: boolean }>,
) => {
  const required = items.filter((item) => item.is_required !== false);
  const completedRequired = required.filter((item) => item.is_completed).length;
  const totalRequired = required.length;
  const percent =
    totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0;
  return { completedRequired, totalRequired, percent };
};
