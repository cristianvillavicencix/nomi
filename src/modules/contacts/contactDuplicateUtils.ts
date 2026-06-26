import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { normalizeUsPhoneToE164 } from "@/utils/phone";

export type DuplicateConfidence = "safe" | "review" | "do_not_merge";

export type DupKey = "email" | "phone" | "name";

export type DupGroup = {
  key: DupKey;
  signal: string;
  contacts: Contact[];
  confidence: DuplicateConfidence;
  confidenceReason: string;
};

export type PendingContactChannels = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export type CreateDuplicateMatch = {
  contact: Contact;
  matchedOn: ("email" | "phone")[];
  confidence: DuplicateConfidence;
  reason: string;
};

export const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizePhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const e164 = normalizeUsPhoneToE164(raw);
  if (e164) return e164.replace(/\D/g, "").slice(-10);
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
};

export const normalizeName = (first?: string | null, last?: string | null) => {
  const parts = [first, last]
    .map((part) => (typeof part === "string" ? part.trim().toLowerCase() : ""))
    .filter((part) => part.length > 0);
  if (parts.length < 1) return null;
  return parts.join(" ");
};

export const extractEmails = (contact: Contact): string[] => {
  const raw = contact.email_jsonb;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return normalizeEmail(entry);
      if (entry && typeof entry === "object" && "email" in entry) {
        return normalizeEmail((entry as { email: unknown }).email);
      }
      return null;
    })
    .filter((email): email is string => email !== null);
};

export const extractPhones = (contact: Contact): string[] => {
  const raw = contact.phone_jsonb;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return normalizePhone(entry);
      if (entry && typeof entry === "object" && "number" in entry) {
        return normalizePhone((entry as { number: unknown }).number);
      }
      return null;
    })
    .filter((phone): phone is string => phone !== null);
};

export const getContactDisplayLabel = (contact: Contact) =>
  [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
  "(no name)";

export const formatContactChannels = (contact: Contact) => {
  const emails = extractEmails(contact);
  const phones = extractPhones(contact);
  return `${emails.join(", ") || "no email"} · ${phones.join(", ") || "no phone"}`;
};

const contactsSharePhone = (left: Contact, right: Contact) => {
  const leftPhones = extractPhones(left);
  const rightPhones = extractPhones(right);
  return leftPhones.some((phone) => rightPhones.includes(phone));
};

const contactsShareEmail = (left: Contact, right: Contact) => {
  const leftEmails = extractEmails(left);
  const rightEmails = extractEmails(right);
  return leftEmails.some((email) => rightEmails.includes(email));
};

export const groupHasSharedPhone = (contacts: Contact[]) => {
  for (let i = 0; i < contacts.length; i += 1) {
    for (let j = i + 1; j < contacts.length; j += 1) {
      if (contactsSharePhone(contacts[i], contacts[j])) return true;
    }
  }
  return false;
};

export const groupHasSharedEmail = (contacts: Contact[]) => {
  for (let i = 0; i < contacts.length; i += 1) {
    for (let j = i + 1; j < contacts.length; j += 1) {
      if (contactsShareEmail(contacts[i], contacts[j])) return true;
    }
  }
  return false;
};

export const classifyDuplicateGroup = (
  contacts: Contact[],
  dimension: DupKey,
): { confidence: DuplicateConfidence; reason: string } => {
  if (contacts.length < 2) {
    return { confidence: "review", reason: "Needs manual review." };
  }

  const names = contacts
    .map((contact) => normalizeName(contact.first_name, contact.last_name))
    .filter((name): name is string => name !== null);
  const uniqueNames = new Set(names);
  const phoneOverlap = groupHasSharedPhone(contacts);
  const emailOverlap = groupHasSharedEmail(contacts);

  if (dimension === "email") {
    if (uniqueNames.size === 1 && names.length === contacts.length) {
      return {
        confidence: "safe",
        reason: "Same email and matching name — likely duplicate records.",
      };
    }
    if (phoneOverlap) {
      return {
        confidence: "safe",
        reason: "Same email with matching phone — likely the same person.",
      };
    }
    if (uniqueNames.size > 1 && !phoneOverlap) {
      return {
        confidence: "do_not_merge",
        reason:
          "Shared email but different names and phones — likely separate people (e.g. company inbox).",
      };
    }
    return {
      confidence: "review",
      reason: "Same email but incomplete match — review before merging.",
    };
  }

  if (dimension === "phone") {
    if (uniqueNames.size === 1 && names.length === contacts.length) {
      return {
        confidence: "safe",
        reason: "Same phone and matching name — likely duplicate records.",
      };
    }
    if (emailOverlap) {
      return {
        confidence: "safe",
        reason: "Same phone with matching email — likely the same person.",
      };
    }
    if (uniqueNames.size > 1 && !emailOverlap) {
      return {
        confidence: "review",
        reason:
          "Shared phone but different names — review (could be family or business line).",
      };
    }
    return {
      confidence: "review",
      reason: "Same phone — review before merging.",
    };
  }

  if (emailOverlap || phoneOverlap) {
    return {
      confidence: "review",
      reason:
        "Same name with overlapping email or phone — review before merging.",
    };
  }

  return {
    confidence: "review",
    reason: "Same name only — common names need manual review.",
  };
};

export const scoreCreateDuplicateMatch = (
  pending: PendingContactChannels,
  contact: Contact,
  matchedOn: ("email" | "phone")[],
): { confidence: DuplicateConfidence; reason: string } => {
  const pendingName = normalizeName(pending.first_name, pending.last_name);
  const contactName = normalizeName(contact.first_name, contact.last_name);
  const nameMatch =
    pendingName !== null && contactName !== null && pendingName === contactName;

  const pendingPhone = pending.phone ? normalizePhone(pending.phone) : null;
  const phoneMatch =
    matchedOn.includes("phone") ||
    (pendingPhone !== null && extractPhones(contact).includes(pendingPhone));

  const emailMatch = matchedOn.includes("email");

  if (emailMatch && phoneMatch && nameMatch) {
    return { confidence: "safe", reason: "Same name, email, and phone." };
  }
  if (emailMatch && phoneMatch) {
    return { confidence: "safe", reason: "Same email and phone." };
  }
  if (emailMatch && nameMatch) {
    return { confidence: "safe", reason: "Same email and name." };
  }
  if (phoneMatch && nameMatch) {
    return { confidence: "safe", reason: "Same phone and name." };
  }
  if (emailMatch && !nameMatch && !phoneMatch) {
    return {
      confidence: "do_not_merge",
      reason: "Email in use by someone else — may be a shared company inbox.",
    };
  }
  if (phoneMatch && !nameMatch && !emailMatch) {
    return {
      confidence: "review",
      reason: "Phone matches but name differs — review carefully.",
    };
  }
  return {
    confidence: "review",
    reason: "Partial overlap — review before merging.",
  };
};

export const buildGroups = (
  contacts: Contact[],
): Record<DupKey, DupGroup[]> => {
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  const byName = new Map<string, Contact[]>();

  for (const contact of contacts) {
    for (const email of extractEmails(contact)) {
      const bucket = byEmail.get(email) ?? [];
      bucket.push(contact);
      byEmail.set(email, bucket);
    }
    for (const phone of extractPhones(contact)) {
      const bucket = byPhone.get(phone) ?? [];
      bucket.push(contact);
      byPhone.set(phone, bucket);
    }
    const nameKey = normalizeName(contact.first_name, contact.last_name);
    if (nameKey && nameKey.split(" ").length >= 2) {
      const bucket = byName.get(nameKey) ?? [];
      bucket.push(contact);
      byName.set(nameKey, bucket);
    }
  }

  const toGroups = (key: DupKey, map: Map<string, Contact[]>): DupGroup[] => {
    const groups: DupGroup[] = [];
    map.forEach((items, signal) => {
      const unique = Array.from(
        new Map(items.map((contact) => [contact.id, contact])).values(),
      );
      if (unique.length >= 2) {
        const { confidence, reason } = classifyDuplicateGroup(unique, key);
        groups.push({
          key,
          signal,
          contacts: unique,
          confidence,
          confidenceReason: reason,
        });
      }
    });
    return groups.sort((a, b) => b.contacts.length - a.contacts.length);
  };

  return {
    email: toGroups("email", byEmail),
    phone: toGroups("phone", byPhone),
    name: toGroups("name", byName),
  };
};

export const findMatchingContacts = async (
  dataProvider: CrmDataProvider,
  pending: PendingContactChannels,
): Promise<CreateDuplicateMatch[]> => {
  const email = normalizeEmail(pending.email);
  const phone = normalizePhone(pending.phone);
  const byId = new Map<string | number, CreateDuplicateMatch>();

  const addContact = (contact: Contact, matchedOn: "email" | "phone") => {
    const existing = byId.get(contact.id);
    const matched = existing
      ? Array.from(new Set([...existing.matchedOn, matchedOn]))
      : [matchedOn];
    const scored = scoreCreateDuplicateMatch(pending, contact, matched);
    byId.set(contact.id, {
      contact,
      matchedOn: matched,
      confidence: scored.confidence,
      reason: scored.reason,
    });
  };

  const verifyAndAdd = (
    contacts: Contact[],
    kind: "email" | "phone",
    value: string,
  ) => {
    for (const contact of contacts) {
      const values =
        kind === "email" ? extractEmails(contact) : extractPhones(contact);
      if (values.includes(value)) {
        addContact(contact, kind);
      }
    }
  };

  if (email) {
    const { data } = await dataProvider.getList<Contact>("contacts_summary", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "id", order: "ASC" },
      filter: { q: email },
    });
    verifyAndAdd(data ?? [], "email", email);
  }

  if (phone) {
    const { data } = await dataProvider.getList<Contact>("contacts_summary", {
      pagination: { page: 1, perPage: 25 },
      sort: { field: "id", order: "ASC" },
      filter: { q: phone },
    });
    verifyAndAdd(data ?? [], "phone", phone);
  }

  const order: Record<DuplicateConfidence, number> = {
    safe: 0,
    review: 1,
    do_not_merge: 2,
  };

  return Array.from(byId.values()).sort(
    (left, right) => order[left.confidence] - order[right.confidence],
  );
};

export const buildEnrichedContactChannels = (
  contact: Contact,
  additions: { email?: string; phone?: string },
) => {
  const email = normalizeEmail(additions.email);
  const phoneRaw = additions.phone?.trim() ?? "";
  const phoneNormalized = phoneRaw ? normalizePhone(phoneRaw) : null;

  const email_jsonb = Array.isArray(contact.email_jsonb)
    ? [...contact.email_jsonb]
    : [];
  if (email && !extractEmails(contact).includes(email)) {
    email_jsonb.push({ email, type: "Work" });
  }

  const phone_jsonb = Array.isArray(contact.phone_jsonb)
    ? [...contact.phone_jsonb]
    : [];
  if (phoneNormalized && !extractPhones(contact).includes(phoneNormalized)) {
    phone_jsonb.push({ number: phoneRaw, type: "Work" });
  }

  return { email_jsonb, phone_jsonb };
};

export const contactNeedsChannelEnrichment = (
  contact: Contact,
  additions: { email?: string; phone?: string },
) => {
  const email = normalizeEmail(additions.email);
  const phone = additions.phone ? normalizePhone(additions.phone) : null;
  const missingEmail =
    email !== null && !extractEmails(contact).includes(email);
  const missingPhone =
    phone !== null && !extractPhones(contact).includes(phone);
  return missingEmail || missingPhone;
};

export const CONFIDENCE_LABELS: Record<
  DuplicateConfidence,
  { label: string; className: string }
> = {
  safe: {
    label: "Safe to merge",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  review: {
    label: "Review manually",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  },
  do_not_merge: {
    label: "Do not merge",
    className: "bg-destructive/15 text-destructive",
  },
};
