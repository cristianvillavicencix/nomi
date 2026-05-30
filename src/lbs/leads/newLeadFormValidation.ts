import type { NewLeadFormValues } from "./newLeadFormTypes";
import { normalizeAssignedMemberIds } from "./leadAssignments";

export type LeadFormValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const hasContactChannel = (values: NewLeadFormValues) => {
  const hasEmail = values.email_jsonb?.some((row) => row.email?.trim());
  const hasPhone = values.phone_jsonb?.some((row) => row.number?.trim());
  return Boolean(hasEmail || hasPhone);
};

export const validateNewLeadForm = (
  values: NewLeadFormValues,
): LeadFormValidationResult => {
  if (!values.lead_source?.trim()) {
    return { ok: false, message: "Lead source is required." };
  }
  if (!values.interested_services?.length) {
    return { ok: false, message: "Select at least one service." };
  }
  if (!values.status?.trim()) {
    return { ok: false, message: "Status is required." };
  }
  if (!normalizeAssignedMemberIds(values.assigned_member_ids).length) {
    return { ok: false, message: "Asigna al menos un miembro del equipo." };
  }

  if (isReferralSource(values.lead_source)) {
    if (!values.referred_by_contact_id && !values.referred_by_company_id) {
      return {
        ok: false,
        message: "Select who referred this lead (contact or company).",
      };
    }
  }

  const showContact =
    values.lead_type === "individual" ||
    (values.lead_type === "business" && values.add_primary_contact);

  if (values.lead_type === "business" && !values.company_draft_name?.trim()) {
    return { ok: false, message: "El nombre de la empresa es obligatorio." };
  }

  if (showContact) {
    if (!values.first_name?.trim()) {
      return { ok: false, message: "El nombre es obligatorio." };
    }
    if (!hasContactChannel(values)) {
      return {
        ok: false,
        message: "Agrega al menos un email o teléfono.",
      };
    }
    if (values.lead_type === "individual" && !values.address?.trim()) {
      return {
        ok: false,
        message: "La dirección es obligatoria (facturación y contacto).",
      };
    }
  }

  return { ok: true };
};
