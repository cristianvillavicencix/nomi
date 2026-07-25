import type { NotificationHistoryItem } from "./types";

const STORAGE_KEY = "nomi.notificationHistory";
const MAX_ITEMS = 80;

const readHistory = (): NotificationHistoryItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = (items: NotificationHistoryItem[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_ITEMS)),
  );
};

export const getNotificationHistory = () => readHistory();

const dedupeKey = (
  item: Pick<NotificationHistoryItem, "category" | "tag" | "href">,
) => item.tag ?? (item.href ? `${item.category}::${item.href}` : null);

export const pushNotificationHistory = (
  item: Omit<NotificationHistoryItem, "id" | "created_at" | "read"> & {
    id?: string;
    created_at?: string;
    read?: boolean;
  },
) => {
  const entry: NotificationHistoryItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: item.category,
    title: item.title,
    body: item.body,
    href: item.href,
    tag: item.tag,
    created_at: item.created_at ?? new Date().toISOString(),
    read: item.read ?? false,
  };

  const key = dedupeKey(entry);
  const history = readHistory();
  const duplicateIndex =
    key == null ? -1 : history.findIndex((row) => dedupeKey(row) === key);

  const next =
    duplicateIndex === -1
      ? [entry, ...history.filter((row) => row.id !== entry.id)]
      : [
          { ...entry, id: history[duplicateIndex].id, read: false },
          ...history.filter((_, index) => index !== duplicateIndex),
        ];

  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
  return entry;
};

export const clearNotificationHistory = () => {
  writeHistory([]);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
};

export const markAllNotificationHistoryRead = () => {
  const next = readHistory().map((item) => ({ ...item, read: true }));
  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
};

export const markNotificationHistoryRead = (id: string) => {
  const next = readHistory().map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
};

export const markNotificationHistoryItemsRead = (ids: string[]) => {
  const idSet = new Set(ids);
  if (idSet.size === 0) return;

  const next = readHistory().map((item) =>
    idSet.has(item.id) ? { ...item, read: true } : item,
  );
  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
};

const TICKET_NOTIFICATION_CATEGORIES = new Set([
  "tickets_message",
  "tickets_assigned",
]);

export const markTicketNotificationsRead = () => {
  const history = readHistory();
  let changed = false;
  const next = history.map((item) => {
    if (!item.read && TICKET_NOTIFICATION_CATEGORIES.has(item.category)) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });
  if (!changed) return;
  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
};

export const countUnreadNotificationHistory = () =>
  readHistory().filter((item) => !item.read).length;
