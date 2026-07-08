export type OrganizationLeadSettings = {
  auto_create_deal_from_web: boolean;
  allow_form_auto_create_deal: boolean;
};

export const DEFAULT_ORGANIZATION_LEAD_SETTINGS: OrganizationLeadSettings = {
  auto_create_deal_from_web: false,
  allow_form_auto_create_deal: false,
};

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const normalizeOrganizationLeadSettings = (
  raw: unknown,
): OrganizationLeadSettings => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_ORGANIZATION_LEAD_SETTINGS };
  }

  const record = raw as Record<string, unknown>;
  return {
    auto_create_deal_from_web: readBoolean(
      record.auto_create_deal_from_web,
      DEFAULT_ORGANIZATION_LEAD_SETTINGS.auto_create_deal_from_web,
    ),
    allow_form_auto_create_deal: readBoolean(
      record.allow_form_auto_create_deal,
      DEFAULT_ORGANIZATION_LEAD_SETTINGS.allow_form_auto_create_deal,
    ),
  };
};
