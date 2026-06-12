import type { Identifier } from "ra-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact } from "@/components/atomic-crm/types";
import { shouldClearPrimaryOnCompany } from "@/modules/clients/primaryContactRelink";
import {
  type CompanyDraft,
  stripContactCompanyFormMeta,
} from "@/modules/contacts/companyDraft";

type OrgMember = {
  id: Identifier;
  org_id: Identifier;
};

export type PersistContactWithCompanyInput = {
  supabase: SupabaseClient;
  member: OrgMember;
  contactData: Record<string, unknown>;
  companyId?: Identifier | null;
  companyDraft?: CompanyDraft | null;
  contactId?: Identifier;
  previousCompanyId?: Identifier | null;
  isCreate: boolean;
};

const createCompanyFromDraft = async (
  supabase: SupabaseClient,
  member: OrgMember,
  draft: CompanyDraft,
): Promise<Identifier> => {
  const { data: newCompany, error } = await supabase
    .from("companies")
    .insert({
      org_id: member.org_id,
      name: draft.name,
      sector: draft.sector,
      organization_member_id: member.id,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !newCompany?.id) {
    throw new Error(error?.message || "Failed to create company");
  }

  return newCompany.id as Identifier;
};

const clearPrimaryOnPreviousCompany = async (
  supabase: SupabaseClient,
  member: OrgMember,
  previousCompanyId: Identifier,
  contactId: Identifier,
) => {
  const { data: previousCompany, error } = await supabase
    .from("companies")
    .select("primary_contact_id")
    .eq("id", previousCompanyId)
    .eq("org_id", member.org_id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load previous company");
  }

  if (!shouldClearPrimaryOnCompany(previousCompany?.primary_contact_id, contactId)) {
    return;
  }

  const { error: clearError } = await supabase
    .from("companies")
    .update({ primary_contact_id: null })
    .eq("id", previousCompanyId)
    .eq("org_id", member.org_id);

  if (clearError) {
    throw new Error("Failed to clear previous primary contact link");
  }
};

export const persistContactWithCompany = async ({
  supabase,
  member,
  contactData,
  companyId: inputCompanyId,
  companyDraft,
  contactId,
  previousCompanyId,
  isCreate,
}: PersistContactWithCompanyInput): Promise<Contact> => {
  let companyId = inputCompanyId ?? null;
  const createdNewCompany = Boolean(companyDraft?.name && companyDraft.sector);

  if (createdNewCompany && companyDraft) {
    companyId = await createCompanyFromDraft(supabase, member, companyDraft);
  }

  if (companyId == null || companyId === "") {
    throw new Error("Company is required");
  }

  if (
    !isCreate &&
    contactId != null &&
    previousCompanyId != null &&
    String(previousCompanyId) !== String(companyId)
  ) {
    await clearPrimaryOnPreviousCompany(
      supabase,
      member,
      previousCompanyId,
      contactId,
    );
  }

  const payload = {
    ...stripContactCompanyFormMeta(contactData),
    company_id: companyId,
  };

  if (isCreate) {
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        org_id: member.org_id,
        ...payload,
      })
      .select("*")
      .single();

    if (error || !contact) {
      throw new Error(error?.message || "Failed to create contact");
    }

    if (createdNewCompany) {
      const { error: primaryError } = await supabase
        .from("companies")
        .update({ primary_contact_id: contact.id })
        .eq("id", companyId)
        .eq("org_id", member.org_id);

      if (primaryError) {
        throw new Error("Failed to link primary contact on new company");
      }
    }

    return contact as Contact;
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", contactId!)
    .eq("org_id", member.org_id)
    .select("*")
    .single();

  if (error || !contact) {
    throw new Error(error?.message || "Failed to update contact");
  }

  if (createdNewCompany) {
    const { error: primaryError } = await supabase
      .from("companies")
      .update({ primary_contact_id: contact.id })
      .eq("id", companyId)
      .eq("org_id", member.org_id);

    if (primaryError) {
      throw new Error("Failed to link primary contact on new company");
    }
  }

  return contact as Contact;
};

export const resolveContactCompanyFromPayload = (
  data: Record<string, unknown>,
) => {
  const draftName = String(data._company_draft_name ?? "").trim();
  const draftSector = String(data._company_draft_sector ?? "").trim();
  const companyDraft =
    draftName && draftSector ? { name: draftName, sector: draftSector } : null;

  return {
    companyId: (data.company_id as Identifier | null | undefined) ?? null,
    companyDraft,
  };
};
