import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { hasPrimaryContactDraft } from "@/modules/clients/lbsClientUpsert";

export type PrimaryContactDraft = {
  fullName: string;
  email: string;
  phone: string;
};

type PersonChannelRow = { email?: string; number?: string };

/** Build a display draft from an in-progress person/contact create form. */
export const getLinkingContactDraftFromPersonForm = (values: {
  first_name?: string;
  last_name?: string;
  email_jsonb?: PersonChannelRow[];
  phone_jsonb?: PersonChannelRow[];
}): PrimaryContactDraft | null => {
  const fullName = [values.first_name, values.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const email =
    values.email_jsonb
      ?.map((row) => row.email?.trim())
      .find(Boolean) ?? "";
  const phone =
    values.phone_jsonb
      ?.map((row) => row.number?.trim())
      .find(Boolean) ?? "";

  if (!fullName && !email && !phone) return null;

  return {
    fullName: fullName || "This contact",
    email,
    phone,
  };
};

export const getPrimaryContactDraftFromFormValues = (
  values: Pick<
    ClientCreateFormValues,
    | "selected_primary_contact_id"
    | "primary_full_name"
    | "primary_email"
    | "primary_phone"
  >,
): PrimaryContactDraft | null => {
  if (values.selected_primary_contact_id != null) return null;
  if (!hasPrimaryContactDraft(values)) return null;
  return {
    fullName: values.primary_full_name.trim(),
    email: values.primary_email.trim(),
    phone: values.primary_phone.trim(),
  };
};

/** True when create-company flow has a pending primary (existing id or local draft). */
export const hasPendingPrimaryOnCreate = (
  values: Pick<
    ClientCreateFormValues,
    | "selected_primary_contact_id"
    | "primary_full_name"
    | "primary_email"
    | "primary_phone"
  >,
) =>
  values.selected_primary_contact_id != null ||
  getPrimaryContactDraftFromFormValues(values) != null;

/**
 * Upsert input for create: link an existing contact, or defer new contact creation
 * to upsertLbsClient (never both).
 */
export const resolveCreatePrimaryUpsertOptions = (
  values: Pick<
    ClientCreateFormValues,
    | "selected_primary_contact_id"
    | "primary_full_name"
    | "primary_email"
    | "primary_phone"
  >,
) => {
  const existingId = values.selected_primary_contact_id;
  if (existingId != null) {
    return {
      primaryContactId: existingId,
      linkPrimaryContactOnly: true as const,
    };
  }
  return {
    primaryContactId: undefined,
    linkPrimaryContactOnly: false as const,
  };
};
