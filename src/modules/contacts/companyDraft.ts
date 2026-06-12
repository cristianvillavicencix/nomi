import type { Identifier } from "ra-core";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/modules/leads/leadFormConstants";

export type CompanyDraft = {
  name: string;
  sector: string;
};

export const COMPANY_DRAFT_NAME_FIELD = "_company_draft_name" as const;
export const COMPANY_DRAFT_SECTOR_FIELD = "_company_draft_sector" as const;
export const PRIMARY_MOVE_CONFIRMED_FIELD = "_primary_move_confirmed" as const;

export const getCompanyDraftFromFormValues = (
  values: Record<string, unknown>,
): CompanyDraft | null => {
  const name = String(values[COMPANY_DRAFT_NAME_FIELD] ?? "").trim();
  if (!name) return null;
  return {
    name,
    sector: String(values[COMPANY_DRAFT_SECTOR_FIELD] ?? "").trim(),
  };
};

export const hasCompanyDraft = (values: Record<string, unknown>) =>
  getCompanyDraftFromFormValues(values) != null;

export const hasValidCompanyDraft = (values: Record<string, unknown>) => {
  const draft = getCompanyDraftFromFormValues(values);
  return draft != null && draft.sector.length > 0;
};

/** True when the contact form has an existing company id or a pending draft. */
export const hasCompanySelection = (
  values: Record<string, unknown>,
  lockCompanyId?: Identifier | null,
) => {
  if (lockCompanyId != null && lockCompanyId !== "") return true;
  if (values.company_id != null && values.company_id !== "") return true;
  return hasValidCompanyDraft(values);
};

export const resolveContactCompanyForSave = (
  values: Record<string, unknown>,
  lockCompanyId?: Identifier | null,
) => {
  if (lockCompanyId != null && lockCompanyId !== "") {
    return { companyId: lockCompanyId, companyDraft: null };
  }

  const draft = getCompanyDraftFromFormValues(values);
  if (draft?.name && draft.sector) {
    return { companyId: null, companyDraft: draft };
  }

  const companyId = values.company_id as Identifier | null | undefined;
  return {
    companyId: companyId ?? null,
    companyDraft: null,
  };
};

export const companySectorLabel = (sector?: string | null) => {
  if (!sector?.trim()) return "";
  return (
    LBS_COMPANY_INDUSTRY_CHOICES.find((entry) => entry.id === sector)?.name ??
    sector
  );
};

export const stripContactCompanyFormMeta = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const {
    [COMPANY_DRAFT_NAME_FIELD]: _draftName,
    [COMPANY_DRAFT_SECTOR_FIELD]: _draftSector,
    [PRIMARY_MOVE_CONFIRMED_FIELD]: _confirmed,
    _compact_full_name,
    _compact_email,
    _compact_phone,
    ...rest
  } = data;
  return rest;
};
