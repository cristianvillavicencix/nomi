import type { Contact, Conversation } from "@/modules/types";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

export type ContactPhoneEntry = {
  e164: string;
  display: string;
  label: string;
};

export const getContactPhoneEntries = (contact: Contact): ContactPhoneEntry[] => {
  const seen = new Set<string>();
  const entries: ContactPhoneEntry[] = [];

  for (const entry of contact.phone_jsonb ?? []) {
    const normalized = normalizeUsPhoneToE164(entry.number ?? "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({
      e164: normalized,
      display: formatUsPhoneDisplayFromAny(normalized),
      label: entry.type?.trim() || "Phone",
    });
  }

  return entries;
};

export const getPrimaryContactPhone = (contact: Contact) => {
  return getContactPhoneEntries(contact)[0]?.e164 ?? null;
};

export const resolveClientSmsPhone = (
  contact: Contact,
  preferred?: string | null,
) => {
  const entries = getContactPhoneEntries(contact);
  if (entries.length === 0) return null;

  if (preferred) {
    const normalized = normalizeUsPhoneToE164(preferred);
    const match = entries.find((entry) => entry.e164 === normalized);
    if (match) return match.e164;
  }

  return entries[0]?.e164 ?? null;
};

export const contactHasSmsPhone = (contact: Contact) =>
  getContactPhoneEntries(contact).length > 0;

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
