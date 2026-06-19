import type { Identifier } from "ra-core";
import type {
  EmailAndType,
  PhoneNumberAndType,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { isValidEmail } from "@/utils/email";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { canMutateCrmResource } from "../commons/crmPermissions";
import { supabase } from "./supabase";
import { uploadToBucket } from "./modules/uploadToBucket";

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const resolveOrganizationMemberId = async (
  id: Identifier,
): Promise<Identifier> => {
  if (typeof id !== "string" || !looksLikeUuid(id)) {
    return id;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", id)
    .single();

  if (error || !data?.id) {
    return id;
  }

  return data.id as Identifier;
};

const getCurrentMutationIdentity = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return null;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id, administrator, roles, module_permissions")
    .eq("user_id", authUserId)
    .single();

  if (!member) return null;

  return {
    id: member.id,
    administrator: member.administrator === true,
    role: member.administrator ? "admin" : (member.roles?.[0] ?? "user"),
    roles: member.roles ?? (member.administrator ? ["admin"] : []),
    module_permissions: member.module_permissions ?? null,
  };
};

export const assertMutationAllowed = async (
  resource: string,
  action: "create" | "update" | "delete",
  params: any,
) => {
  const identity =
    params?.meta?.identity ?? (await getCurrentMutationIdentity());
  const data = params?.data ?? params?.previousData ?? {};

  if (
    !canMutateCrmResource({
      identity,
      resource,
      action,
      data,
    })
  ) {
    throw new Error("No tienes permiso para esta acción");
  }

  return identity;
};

export const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const normalizeEmailValue = (value?: string | null, label = "email") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!isValidEmail(trimmed)) {
    throw new Error(`Invalid ${label}`);
  }

  return trimmed;
};

const normalizePhoneValue = (value?: string | null, label = "phone") => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeUsPhoneToE164(trimmed);
  if (!normalized) {
    throw new Error(`Invalid ${label}. Use 10 digits`);
  }

  return normalized;
};

const normalizeEmailEntries = (entries?: EmailAndType[]) =>
  entries
    ?.map((entry) => {
      const email = normalizeEmailValue(entry.email, "email");
      return email ? { ...entry, email } : null;
    })
    .filter((entry): entry is EmailAndType => entry != null);

const normalizePhoneEntries = (entries?: PhoneNumberAndType[]) =>
  entries
    ?.map((entry) => {
      const number = normalizePhoneValue(entry.number);
      return number ? { ...entry, number } : null;
    })
    .filter((entry): entry is PhoneNumberAndType => entry != null);

export const normalizeContactData = <
  T extends {
    email_jsonb?: EmailAndType[];
    phone_jsonb?: PhoneNumberAndType[];
  },
>(
  data: T,
): T => ({
  ...data,
  email_jsonb: normalizeEmailEntries(data.email_jsonb),
  phone_jsonb: normalizePhoneEntries(data.phone_jsonb),
});

/** Fields from contacts_summary / form UI that must not be PATCHed to contacts. */
const CONTACT_READ_ONLY_WRITE_FIELDS = [
  "company_name",
  "nb_tasks",
  "full_name",
  "name",
  "is_primary_contact",
  "email_fts",
  "phone_fts",
] as const;

/** Fields from companies_summary that must not be PATCHed to companies. */
const COMPANY_READ_ONLY_WRITE_FIELDS = [
  "nb_deals",
  "nb_contacts",
  "primary_contact_first_name",
  "primary_contact_last_name",
  "primary_contact_status",
  "primary_contact_email_jsonb",
  "primary_contact_phone_jsonb",
  "primary_contact_lead_source",
  "primary_contact_interested_service",
] as const;

export const prepareCompanyWriteData = <
  T extends Record<string, unknown>,
>(
  data: T,
): T => {
  const rest = { ...data };

  for (const field of COMPANY_READ_ONLY_WRITE_FIELDS) {
    delete rest[field];
  }

  if ("phone_number" in rest) {
    const raw = rest.phone_number;
    if (raw == null || String(raw).trim() === "") {
      rest.phone_number = null;
    } else {
      const normalized = normalizeUsPhoneToE164(String(raw).trim());
      if (!normalized) {
        throw new Error("Invalid phone. Use 10 digits");
      }
      rest.phone_number = normalized;
    }
  }

  return rest as T;
};

export const prepareContactWriteData = <
  T extends Record<string, unknown>,
>(
  data: T,
): T => {
  const {
    _company_draft_name: _draftName,
    _company_draft_sector: _draftSector,
    _primary_move_confirmed: _confirmed,
    _compact_first_name: _compactFirst,
    _compact_last_name: _compactLast,
    _compact_email: _compactEmail,
    _compact_phone: _compactPhone,
    ...rest
  } = data;

  for (const field of CONTACT_READ_ONLY_WRITE_FIELDS) {
    delete rest[field];
  }

  return normalizeContactData(rest as T & {
    email_jsonb?: EmailAndType[];
    phone_jsonb?: PhoneNumberAndType[];
  });
};

const CONTACT_UPDATE_OMIT_FIELDS = [
  "id",
  "org_id",
  "company_name",
  "nb_tasks",
  "full_name",
  "name",
  "is_primary_contact",
  "email_fts",
  "phone_fts",
] as const;

const stripContactSummaryComputedFields = (payload: Record<string, unknown>) => {
  for (const key of Object.keys(payload)) {
    if (key.endsWith("_fts")) {
      delete payload[key];
    }
  }
};

export const fetchContactSummaryById = async (contactId: Identifier) =>
  getOneFromResourceMaybeSingle("contacts_summary", contactId);

export const patchContactRow = async ({
  contactId,
  orgId,
  data,
}: {
  contactId: Identifier;
  orgId: Identifier;
  data: Record<string, unknown>;
}) => {
  const payload = prepareContactWriteData({ ...data });
  for (const field of CONTACT_UPDATE_OMIT_FIELDS) {
    delete payload[field];
  }
  stripContactSummaryComputedFields(payload);

  const { data: row, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", contactId)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update contact");
  }
  if (row == null) {
    throw new Error(
      "Contact not found or you do not have permission to update it.",
    );
  }

  return row;
};

export const getOneFromResourceMaybeSingle = async (
  resource: string,
  id: Identifier,
) => {
  const { data, error } = await supabase
    .from(resource)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * PostgREST returns 406 (object+json coercion) when an update matches 0 rows under RLS.
 * Use `.maybeSingle()` plus a clear server message instead of relying on react-admin PATCH.
 */
export const patchSingletonConfigurationRow = async (
  config: ConfigurationContextValue,
) => {
  const { data, error } = await supabase
    .from("configuration")
    .update({ config })
    .eq("id", 1)
    .select()
    .maybeSingle();

  if (error) {
    console.error("configuration.update", error);
    throw new Error(error.message || "Failed to save configuration");
  }
  if (data == null) {
    throw new Error(
      "Could not save workspace settings. You must be a company administrator to edit configuration.",
    );
  }

  return data;
};

export const normalizeMemberEmail = (email: unknown) =>
  normalizeEmailValue(typeof email === "string" ? email : undefined, "email") ??
  "";
