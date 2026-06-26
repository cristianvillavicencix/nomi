import type { Contact } from "@/components/atomic-crm/types";

export const normalizeTicketEmail = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const contactHasEmail = (contact: Contact, email: string): boolean => {
  const target = normalizeTicketEmail(email);
  if (!target) return false;
  return (contact.email_jsonb ?? []).some(
    (row) => normalizeTicketEmail(row.email) === target,
  );
};

export const findContactsByExactEmail = (
  contacts: Contact[],
  email: string,
): Contact[] => {
  const target = normalizeTicketEmail(email);
  if (!target) return [];
  return contacts.filter((contact) => contactHasEmail(contact, target));
};
