export type OrganizationAssistantSettings = {
  enabled: boolean;
};

export const DEFAULT_ASSISTANT_SETTINGS: OrganizationAssistantSettings = {
  enabled: true,
};

export const normalizeAssistantSettings = (
  raw: unknown,
): OrganizationAssistantSettings => {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_ASSISTANT_SETTINGS };
  }
  const row = raw as Record<string, unknown>;
  return {
    enabled: row.enabled === false ? false : true,
  };
};
