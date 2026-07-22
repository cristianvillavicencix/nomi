import type { Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { contactMatchesId } from "@/modules/tickets/ticketRequester";

export { contactMatchesId };

/** Pick primary contact when company changes or current contact is invalid. */
export const resolvePrimaryContactId = (
  companyId: Identifier | null | undefined,
  contactId: Identifier | null | undefined,
  companyContacts: Contact[],
  primaryContactId?: Identifier | null,
): Identifier | null => {
  if (!companyId) return null;

  if (
    contactId != null &&
    companyContacts.some((contact) => contactMatchesId(contact, contactId))
  ) {
    return contactId;
  }

  if (companyContacts.length === 1) {
    return companyContacts[0].id;
  }

  if (primaryContactId != null) {
    const primaryContact = companyContacts.find((contact) =>
      contactMatchesId(contact, primaryContactId),
    );
    if (primaryContact) return primaryContact.id;
  }

  return null;
};

export const dealBelongsToCompany = (
  dealCompanyId: Identifier | null | undefined,
  companyId: Identifier | null | undefined,
) =>
  companyId != null &&
  dealCompanyId != null &&
  String(dealCompanyId) === String(companyId);
