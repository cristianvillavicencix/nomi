import { evaluateCondition } from "./conditionalLogic.ts";
import type { FormFieldDef, FormSchema, FormSectionDef } from "./formV2Schema.ts";

type BriefApproval = {
  section_id: string;
  status?: string;
  approved_at?: string | null;
  approved_by_member_id?: number | null;
  revision_requested_at?: string | null;
  revision_notes?: string | null;
};

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
};

const isFieldFilled = (
  field: FormFieldDef,
  brief: Record<string, unknown>,
): boolean => {
  if (field.type === "formula") return true;
  const value = brief[field.key];
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return Boolean(readString(value));
};

const isSectionComplete = (
  section: FormSectionDef,
  brief: Record<string, unknown>,
): boolean => {
  if (!evaluateCondition(section.visible_when, brief)) return false;

  const fields = (section.fields ?? []).filter(
    (field) =>
      field.type !== "formula" &&
      evaluateCondition(field.visible_when, brief),
  );
  if (fields.length === 0) return false;
  return fields.every((field) => isFieldFilled(field, brief));
};

const parseApprovals = (brief: Record<string, unknown>): BriefApproval[] => {
  const raw = brief._approvals;
  return Array.isArray(raw) ? (raw as BriefApproval[]) : [];
};

const approveSection = (
  brief: Record<string, unknown>,
  sectionId: string,
): Record<string, unknown> => {
  const approvals = parseApprovals(brief).filter(
    (entry) => entry.section_id !== sectionId,
  );
  return {
    ...brief,
    _approvals: [
      ...approvals,
      {
        section_id: sectionId,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_member_id: null,
        revision_requested_at: null,
        revision_notes: null,
      },
    ],
  };
};

export const syncBriefApprovalsFromSchema = (
  brief: Record<string, unknown>,
  schema: FormSchema | null | undefined,
): Record<string, unknown> => {
  let next = { ...brief };
  for (const section of schema?.sections ?? []) {
    if (!section.id) continue;
    if (!isSectionComplete(section, next)) continue;
    const current = parseApprovals(next).find(
      (entry) => entry.section_id === section.id,
    );
    if (current?.status === "approved") continue;
    next = approveSection(next, section.id);
  }
  return next;
};
