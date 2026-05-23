import type { Contact, Conversation } from "@/lbs/types";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

export const getPrimaryContactPhone = (contact: Contact) => {
  for (const entry of contact.phone_jsonb ?? []) {
    const normalized = normalizeUsPhoneToE164(entry.number ?? "");
    if (normalized) return normalized;
  }
  return null;
};

export const contactHasSmsPhone = (contact: Contact) =>
  getPrimaryContactPhone(contact) != null;

export const getContactDisplayName = (contact: Contact) =>
  `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
  contact.email_jsonb?.[0]?.email ||
  `Contact #${contact.id}`;

export const getContactPhoneLabel = (contact: Contact) => {
  const phone = getPrimaryContactPhone(contact);
  return phone ? formatUsPhoneDisplayFromAny(phone) : "No phone";
};

export const contactAlreadyHasClientConversation = (
  contact: Contact,
  conversations: Conversation[],
) => {
  const contactId = String(contact.id);
  const phone = getPrimaryContactPhone(contact);

  return conversations.some((conversation) => {
    if (conversation.type !== "client") return false;
    if (!conversation.last_message_at) return false;
    if (
      conversation.contact_id != null &&
      String(conversation.contact_id) === contactId
    ) {
      return true;
    }
    if (phone && conversation.external_phone === phone) {
      return true;
    }
    return false;
  });
};
