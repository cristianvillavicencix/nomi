import type { Contact } from "@/components/atomic-crm/types";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import {
  getWorkCategoryMeta,
  type WorkCategory,
} from "@/modules/work/workCategoryUtils";
import type { WorkItem } from "@/modules/work/workTypes";

const CATEGORY_SEARCH_ALIASES: Partial<Record<WorkCategory, string[]>> = {
  follow_up: ["follow up", "follow-up", "followup", "reminder"],
  meeting: ["meeting", "video call", "call"],
  activity: ["activity"],
  delivery: ["delivery", "milestone"],
  task: ["task"],
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export const tokenizeWorkSearchQuery = (query: string) =>
  normalizeSearchText(query).split(" ").filter(Boolean);

const getContactName = (contact?: Contact | null) => {
  if (!contact) return null;
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || null;
};

const getContactIdFromEvent = (event: CalendarEvent) => {
  if (event.kind === "task") {
    return event.task.contact_id ?? null;
  }
  if ("record" in event) {
    return event.record.contact_id ?? null;
  }
  return null;
};

export const buildWorkItemSearchText = (
  item: WorkItem,
  contactsById?: Map<string, Contact>,
) => {
  const parts: string[] = [
    item.title,
    item.dealName ?? "",
    getWorkCategoryMeta(item.category).label,
    ...(CATEGORY_SEARCH_ALIASES[item.category] ?? []),
  ];

  const { event } = item;

  if ("contactName" in event && event.contactName) {
    parts.push(event.contactName);
  }

  if ("assignedName" in event && event.assignedName) {
    parts.push(event.assignedName);
  }

  if ("record" in event) {
    if (event.record.description) parts.push(event.record.description);
    if (event.record.location) parts.push(event.record.location);
    if (event.record.title) parts.push(event.record.title);
  }

  if (event.kind === "task") {
    parts.push(event.task.text);
    if (event.task.type) parts.push(event.task.type);
  }

  const contactId = getContactIdFromEvent(event);
  if (contactId != null && contactsById) {
    const contactName = getContactName(contactsById.get(String(contactId)));
    if (contactName) parts.push(contactName);
  }

  return normalizeSearchText(parts.filter(Boolean).join(" "));
};

export const matchesWorkItemSearch = (
  item: WorkItem,
  query: string,
  contactsById?: Map<string, Contact>,
) => {
  const tokens = tokenizeWorkSearchQuery(query);
  if (tokens.length === 0) return true;

  const haystack = buildWorkItemSearchText(item, contactsById);
  return tokens.every((token) => haystack.includes(token));
};

export const filterWorkItemsBySearch = (
  items: WorkItem[],
  query: string,
  contactsById?: Map<string, Contact>,
) => {
  const trimmed = query.trim();
  if (!trimmed) return items;
  return items.filter((item) =>
    matchesWorkItemSearch(item, trimmed, contactsById),
  );
};
