import type { LbsDeal } from "@/lbs/types";

export const MANUAL_HANDOFF_AT_KEY = "_manual_handoff_at";
export const MANUAL_HANDOFF_BY_KEY = "_manual_handoff_by";

export const isBriefMetadataKey = (key: string) => key.startsWith("_");

export const isBriefRequirementsWaived = (
  record: Pick<LbsDeal, "website_brief">,
) => {
  const at = record.website_brief?.[MANUAL_HANDOFF_AT_KEY];
  return typeof at === "string" && at.trim().length > 0;
};

export const getManualHandoffAt = (
  record: Pick<LbsDeal, "website_brief">,
): string | null => {
  const at = record.website_brief?.[MANUAL_HANDOFF_AT_KEY];
  return typeof at === "string" && at.trim() ? at : null;
};

export const buildManualHandoffBriefUpdate = (
  current: Record<string, string | null | undefined> | null | undefined,
  enable: boolean,
  memberId?: string | number | null,
): Record<string, string | null | undefined> => {
  const brief = { ...(current ?? {}) };
  if (enable) {
    brief[MANUAL_HANDOFF_AT_KEY] = new Date().toISOString();
    if (memberId != null) {
      brief[MANUAL_HANDOFF_BY_KEY] = String(memberId);
    }
  } else {
    delete brief[MANUAL_HANDOFF_AT_KEY];
    delete brief[MANUAL_HANDOFF_BY_KEY];
  }
  return brief;
};
