import type { Identifier } from "ra-core";

const STORAGE_KEY = "nomi:messages:lastRead";

export const getLocalLastReadMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const setLocalLastRead = (conversationId: Identifier, readAt: string) => {
  const current = getLocalLastReadMap();
  current[String(conversationId)] = readAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
};
