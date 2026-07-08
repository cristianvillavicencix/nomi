import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import {
  formatPhoneForStorage,
  mergeBackground,
  normalizeLbsLeadPayload,
  normalizeWebsiteHost,
  validateLbsLeadPayload,
  type LbsLeadPayload,
  type NormalizedLbsLead,
} from "./lbsLeadIngestLogic.ts";

export type { LbsLeadPayload } from "./lbsLeadIngestLogic.ts";

export type IngestLbsLeadResult = {
  contactId: number;
  companyId: number | null;
  dealId: number | null;
  createdContact: boolean;
  createdCompany: boolean;
  createdDeal: boolean;
};

type ContactRow = {
  id: number;
  company_id: number | null;
  background: string | null;
};

type CompanyRow = {
  id: number;
  name: string;
  website: string | null;
  phone_number: string | null;
  address: string | null;
  sector: string | null;
  primary_contact_id: number | null;
};

const escapeJsonContainsValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

async function findContactByPhone(
  supabase: SupabaseClient,
  orgId: number,
  phone: string,
) {
  const normalized = normalizeUsPhoneToE164(phone);
  if (!normalized) return null;

  const { data, error } = await supabase.rpc("find_contact_by_phone", {
    p_org_id: orgId,
    p_phone: normalized,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to find contact by phone");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

async function findContactByEmail(
  supabase: SupabaseClient,
  orgId: number,
  email: string,
): Promise<ContactRow | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_id, background")
    .eq("org_id", orgId)
    .filter(
      "email_jsonb",
      "cs",
      `[{"email":"${escapeJsonContainsValue(normalized)}"}]`,
    )
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Failed to find contact by email");
  return data ?? null;
}

async function findReferrerContactId(
  supabase: SupabaseClient,
  orgId: number,
  referidor?: LbsLeadPayload["referidor"],
): Promise<number | null> {
  const email = referidor?.email?.trim().toLowerCase() ?? null;
  const phone = formatPhoneForStorage(referidor?.phone);

  if (email) {
    const byEmail = await findContactByEmail(supabase, orgId, email);
    if (byEmail?.id) return byEmail.id;
  }

  if (phone) {
    const byPhone = await findContactByPhone(supabase, orgId, phone);
    if (byPhone?.id) return byPhone.id;
  }

  return null;
}

async function findCompanyByWebsite(
  supabase: SupabaseClient,
  orgId: number,
  website: string | null,
): Promise<CompanyRow | null> {
  const host = normalizeWebsiteHost(website);
  if (!host) return null;

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, website, phone_number, address, sector, primary_contact_id",
    )
    .eq("org_id", orgId)
    .not("website", "is", null);

  if (error) throw new Error(error.message ?? "Failed to find company by website");

  return (
    (data ?? []).find(
      (company) => normalizeWebsiteHost(company.website) === host,
    ) ?? null
  );
}

async function findCompanyByName(
  supabase: SupabaseClient,
  orgId: number,
  name: string,
): Promise<CompanyRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, website, phone_number, address, sector, primary_contact_id",
    )
    .eq("org_id", orgId)
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Failed to find company by name");
  return data ?? null;
}

async function upsertCompany(
  supabase: SupabaseClient,
  orgId: number,
  lead: NormalizedLbsLead,
  organizationMemberId: number | null,
): Promise<{ company: CompanyRow; created: boolean }> {
  let company =
    (await findCompanyByWebsite(supabase, orgId, lead.website)) ??
    (await findCompanyByName(supabase, orgId, lead.businessName));

  if (company) {
    const updates: Record<string, unknown> = {};
    if (!company.website && lead.website) updates.website = lead.website;
    if (!company.phone_number && lead.companyPhone) {
      updates.phone_number = lead.companyPhone;
    }
    if (!company.address && lead.address) updates.address = lead.address;
    if (!company.sector && lead.sector) updates.sector = lead.sector;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", company.id)
        .eq("org_id", orgId)
        .select(
          "id, name, website, phone_number, address, sector, primary_contact_id",
        )
        .single();

      if (error) throw new Error(error.message ?? "Failed to update company");
      company = data;
    }

    return { company, created: false };
  }

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    name: lead.businessName,
    website: lead.website,
    phone_number: lead.companyPhone,
    address: lead.address,
    sector: lead.sector,
  };

  if (organizationMemberId != null) {
    insertPayload.organization_member_id = organizationMemberId;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert(insertPayload)
    .select(
      "id, name, website, phone_number, address, sector, primary_contact_id",
    )
    .single();

  if (error) throw new Error(error.message ?? "Failed to create company");
  return { company: data, created: true };
}

async function upsertContact(
  supabase: SupabaseClient,
  orgId: number,
  lead: NormalizedLbsLead,
  companyId: number | null,
  organizationMemberId: number | null,
): Promise<{ contact: ContactRow; created: boolean }> {
  let existing: ContactRow | null = null;

  if (lead.contactEmail) {
    existing = await findContactByEmail(supabase, orgId, lead.contactEmail);
  }

  if (!existing && lead.contactPhone) {
    const byPhone = await findContactByPhone(supabase, orgId, lead.contactPhone);
    if (byPhone?.id) {
      existing = {
        id: byPhone.id,
        company_id: byPhone.company_id ?? null,
        background: null,
      };
    }
  }

  const now = new Date().toISOString();

  if (existing) {
    const { data: current, error: fetchError } = await supabase
      .from("contacts")
      .select("id, company_id, background")
      .eq("id", existing.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (fetchError || !current) {
      throw new Error(fetchError?.message ?? "Failed to load existing contact");
    }

    const updates: Record<string, unknown> = {
      last_seen: now,
      background: mergeBackground(current.background, lead.background),
    };

    if (!current.company_id && companyId) updates.company_id = companyId;
    if (lead.interestedService) updates.interested_service = lead.interestedService;
    if (lead.referredByContactId) {
      updates.referred_by_contact_id = lead.referredByContactId;
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", current.id)
      .eq("org_id", orgId)
      .select("id, company_id, background")
      .single();

    if (error) throw new Error(error.message ?? "Failed to update contact");
    return { contact: data, created: false };
  }

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    first_name: lead.contactFirstName,
    last_name: lead.contactLastName,
    status: "lead",
    lead_stage: "new",
    lead_source: lead.leadSource,
    company_id: companyId,
    email_jsonb: lead.contactEmail
      ? [{ email: lead.contactEmail, type: "Work" }]
      : [],
    phone_jsonb: lead.contactPhone
      ? [{ number: lead.contactPhone, type: "Work" }]
      : [],
    interested_service: lead.interestedService,
    background: lead.background,
    first_seen: now,
    last_seen: now,
  };

  if (lead.referredByContactId) {
    insertPayload.referred_by_contact_id = lead.referredByContactId;
  }

  if (organizationMemberId != null) {
    insertPayload.organization_member_id = organizationMemberId;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(insertPayload)
    .select("id, company_id, background")
    .single();

  if (error) throw new Error(error.message ?? "Failed to create contact");
  return { contact: data, created: true };
}

async function ensurePrimaryContact(
  supabase: SupabaseClient,
  orgId: number,
  companyId: number,
  contactId: number,
  currentPrimaryContactId: number | null,
) {
  if (currentPrimaryContactId === contactId) return;

  const { error } = await supabase
    .from("companies")
    .update({ primary_contact_id: contactId })
    .eq("id", companyId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message ?? "Failed to set primary contact on company");
  }
}

async function createDealIfNeeded(
  supabase: SupabaseClient,
  orgId: number,
  lead: NormalizedLbsLead,
  contactId: number,
  companyId: number | null,
  organizationMemberId: number | null,
): Promise<{ dealId: number | null; created: boolean }> {
  if (!lead.shouldCreateDeal) return { dealId: null, created: false };

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    name: lead.dealName,
    stage: "lead",
    contact_id: contactId,
    contact_ids: [contactId],
    company_id: companyId,
    description: lead.dealDescription,
  };

  if (organizationMemberId != null) {
    insertPayload.organization_member_id = organizationMemberId;
  }

  const { data, error } = await supabase
    .from("deals")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) throw new Error(error.message ?? "Failed to create deal");
  return { dealId: data.id, created: true };
}

export async function ingestLbsLead(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    payload: LbsLeadPayload;
    organizationMemberId?: number | null;
  },
): Promise<IngestLbsLeadResult> {
  const validation = validateLbsLeadPayload(params.payload);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const lead = normalizeLbsLeadPayload(params.payload);

  if (lead.leadSource === "Referido") {
    lead.referredByContactId = await findReferrerContactId(
      supabase,
      params.orgId,
      params.payload.referidor,
    );
  }

  const organizationMemberId = params.organizationMemberId ?? null;

  const { company, created: createdCompany } = await upsertCompany(
    supabase,
    params.orgId,
    lead,
    organizationMemberId,
  );

  const { contact, created: createdContact } = await upsertContact(
    supabase,
    params.orgId,
    lead,
    company.id,
    organizationMemberId,
  );

  await ensurePrimaryContact(
    supabase,
    params.orgId,
    company.id,
    contact.id,
    company.primary_contact_id,
  );

  const { dealId, created: createdDeal } = await createDealIfNeeded(
    supabase,
    params.orgId,
    lead,
    contact.id,
    company.id,
    organizationMemberId,
  );

  return {
    contactId: contact.id,
    companyId: company.id,
    dealId,
    createdContact,
    createdCompany,
    createdDeal,
  };
}
