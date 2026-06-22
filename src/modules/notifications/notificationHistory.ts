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
    created_at: item.created_at ?? new Date().toISOString(),
    read: item.read ?? false,
  };

  const next = [entry, ...readHistory().filter((row) => row.id !== entry.id)];
  writeHistory(next);
  window.dispatchEvent(new CustomEvent("nomi:notifications-updated"));
  return entry;
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

export const countUnreadNotificationHistory = () =>
  readHistory().filter((item) => !item.read).length;
