import type { Identifier } from "ra-core";

/** Returns true when a contact must be moved off its current company before linking. */
export const contactNeedsCompanyMove = (
  contactCompanyId: Identifier | null | undefined,
  targetCompanyId: Identifier,
) =>
  contactCompanyId != null &&
  contactCompanyId !== "" &&
  String(contactCompanyId) !== String(targetCompanyId);

export const shouldClearPrimaryOnCompany = (
  companyPrimaryContactId: Identifier | null | undefined,
  movingContactId: Identifier,
) =>
  companyPrimaryContactId != null &&
  String(companyPrimaryContactId) === String(movingContactId);
