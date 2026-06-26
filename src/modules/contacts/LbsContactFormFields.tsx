import type { Identifier } from "ra-core";
import { PersonFormFields } from "@/modules/contacts/PersonFormFields";

export type LbsContactFormFieldsProps = {
  /** Compact create: name, email, phone, company only until expanded. */
  variant?: "full" | "compact" | "create";
  /** When set, company field is hidden and not editable. */
  lockCompanyId?: Identifier;
};

/** Directory contact fields — delegates to the unified person form. */
export const LbsContactFormFields = ({
  variant = "full",
  lockCompanyId,
}: LbsContactFormFieldsProps) => (
  <PersonFormFields
    mode="directory"
    variant={variant}
    lockCompanyId={lockCompanyId}
  />
);

/** Combine first/last name into a single display name. */
export const compactContactFullName = (values: Record<string, unknown>) =>
  [
    String(values.first_name ?? "").trim(),
    String(values.last_name ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

/** True when the form has at least a first name entered. */
export const hasCompactContactName = (values: Record<string, unknown>) =>
  String(values.first_name ?? "").trim().length > 0;

/** Map dialog fields to a Contact create/update payload fragment. */
export const compactContactFieldsToPayload = (
  values: Record<string, unknown>,
) => {
  const firstName = String(values.first_name ?? "").trim();
  const lastName = String(values.last_name ?? "").trim() || firstName;
  const emailRows = values.email_jsonb as
    | Array<{ email?: string; type?: string }>
    | undefined;
  const phoneRows = values.phone_jsonb as
    | Array<{ number?: string; type?: string }>
    | undefined;
  const emailValue = String(emailRows?.[0]?.email ?? "").trim();
  const phoneValue = String(phoneRows?.[0]?.number ?? "").trim();

  return {
    first_name: firstName,
    last_name: lastName,
    email_jsonb: emailValue
      ? [{ email: emailValue, type: "Work" as const }]
      : [],
    phone_jsonb: phoneValue
      ? [{ number: phoneValue, type: "Work" as const }]
      : [],
  };
};
