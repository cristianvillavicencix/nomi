import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { hasPrimaryContactDraft } from "@/modules/clients/lbsClientUpsert";

export type PrimaryContactDraft = {
  fullName: string;
  email: string;
  phone: string;
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
