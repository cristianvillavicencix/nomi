import type { Identifier } from "ra-core";
import type { Company } from "@/components/atomic-crm/types";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/modules/leads/leadFormConstants";

export type CompanyDraft = {
  name: string;
  sector: string;
  website?: string;
  phone?: string;
  address?: string;
};

export const COMPANY_DRAFT_NAME_FIELD = "company_draft_name" as const;
export const COMPANY_DRAFT_WEBSITE_FIELD = "company_draft_website" as const;
export const COMPANY_DRAFT_PHONE_FIELD = "company_draft_phone" as const;
export const COMPANY_DRAFT_ADDRESS_FIELD = "company_draft_address" as const;
export const COMPANY_DRAFT_SECTOR_FIELD = "company_draft_sector" as const;

export const COMPANY_DRAFT_FIELD_NAMES = [
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_WEBSITE_FIELD,
  COMPANY_DRAFT_PHONE_FIELD,
  COMPANY_DRAFT_ADDRESS_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
] as const;

/** @deprecated Legacy meta keys — read for backward compatibility only. */
const LEGACY_COMPANY_DRAFT_NAME_FIELD = "_company_draft_name";
const LEGACY_COMPANY_DRAFT_SECTOR_FIELD = "_company_draft_sector";

export const PRIMARY_MOVE_CONFIRMED_FIELD = "_primary_move_confirmed" as const;

export const emptyCompanyDraftFormFields = () => ({
  [COMPANY_DRAFT_NAME_FIELD]: "",
  [COMPANY_DRAFT_WEBSITE_FIELD]: "",
  [COMPANY_DRAFT_PHONE_FIELD]: "",
  [COMPANY_DRAFT_ADDRESS_FIELD]: "",
  [COMPANY_DRAFT_SECTOR_FIELD]: "",
});

const readDraftField = (
  values: Record<string, unknown>,
  key: string,
  legacyKey?: string,
) => {
  const current = String(values[key] ?? "").trim();
  if (current) return current;
  if (legacyKey) return String(values[legacyKey] ?? "").trim();
  return "";
};

export const getCompanyDraftFromFormValues = (
  values: Record<string, unknown>,
): CompanyDraft | null => {
  const name = readDraftField(
    values,
    COMPANY_DRAFT_NAME_FIELD,
    LEGACY_COMPANY_DRAFT_NAME_FIELD,
  );
  if (!name) return null;

  return {
    name,
    sector: readDraftField(
      values,
      COMPANY_DRAFT_SECTOR_FIELD,
      LEGACY_COMPANY_DRAFT_SECTOR_FIELD,
    ),
    website: readDraftField(values, COMPANY_DRAFT_WEBSITE_FIELD),
    phone: readDraftField(values, COMPANY_DRAFT_PHONE_FIELD),
    address: readDraftField(values, COMPANY_DRAFT_ADDRESS_FIELD),
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

  const companyId = values.company_id as Identifier | null | undefined;
  if (companyId != null && companyId !== "") {
    return { companyId, companyDraft: null };
  }

  const draft = getCompanyDraftFromFormValues(values);
  if (draft?.name && draft.sector) {
    return { companyId: null, companyDraft: draft };
  }

  return {
    companyId: null,
    companyDraft: null,
  };
};

const normalizeWebsite = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

/** Maps a company draft to a `companies` create payload (contact + lead flows). */
export const companyDraftToCreateData = (
  draft: CompanyDraft,
  organizationMemberId?: Identifier,
): Partial<Company> => ({
  name: draft.name.trim(),
  website: normalizeWebsite(draft.website ?? ""),
  phone_number: (draft.phone ?? "").trim(),
  address: (draft.address ?? "").trim(),
  sector: draft.sector || "other",
  organization_member_id: organizationMemberId,
  created_at: new Date().toISOString(),
});

export const companySectorLabel = (sector?: string | null) => {
  if (!sector?.trim()) return "";
  return (
    LBS_COMPANY_INDUSTRY_CHOICES.find((entry) => entry.id === sector)?.name ??
    sector
  );
};

export const clearCompanyDraftFormFields = (
  setValue: (
    name: (typeof COMPANY_DRAFT_FIELD_NAMES)[number],
    value: string,
    options?: { shouldDirty?: boolean },
  ) => void,
) => {
  for (const field of COMPANY_DRAFT_FIELD_NAMES) {
    setValue(field, "", { shouldDirty: true });
  }
};

export const stripContactCompanyFormMeta = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const {
    [COMPANY_DRAFT_NAME_FIELD]: _name,
    [COMPANY_DRAFT_WEBSITE_FIELD]: _website,
    [COMPANY_DRAFT_PHONE_FIELD]: _phone,
    [COMPANY_DRAFT_ADDRESS_FIELD]: _address,
    [COMPANY_DRAFT_SECTOR_FIELD]: _sector,
    [LEGACY_COMPANY_DRAFT_NAME_FIELD]: _legacyName,
    [LEGACY_COMPANY_DRAFT_SECTOR_FIELD]: _legacySector,
    [PRIMARY_MOVE_CONFIRMED_FIELD]: _confirmed,
    _compact_first_name,
    _compact_last_name,
    _compact_email,
    _compact_phone,
    ...rest
  } = data;
  return rest;
};
