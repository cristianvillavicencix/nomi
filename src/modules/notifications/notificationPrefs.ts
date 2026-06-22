import type { NotificationCategory, NotificationPrefs } from "./types";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  sound_enabled: true,
  desktop_enabled: true,
  messages_sms: true,
  messages_internal: true,
  tickets_message: true,
  tickets_assigned: true,
  tasks_mention: true,
  leads_followup_due: true,
  leads_stale: true,
};

const BOOL_KEYS = Object.keys(
  DEFAULT_NOTIFICATION_PREFS,
) as (keyof NotificationPrefs)[];

export const parseNotificationPrefs = (
  value: unknown,
): NotificationPrefs => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }

  const record = value as Record<string, unknown>;
  const next = { ...DEFAULT_NOTIFICATION_PREFS };

  for (const key of BOOL_KEYS) {
    if (typeof record[key] === "boolean") {
      next[key] = record[key];
    }
  }

  return next;
};

export const isNotificationCategoryEnabled = (
  prefs: NotificationPrefs,
  category: NotificationCategory,
) => {
  switch (category) {
    case "messages_sms":
      return prefs.messages_sms;
    case "messages_internal":
      return prefs.messages_internal;
    case "tickets_message":
      return prefs.tickets_message;
    case "tickets_assigned":
      return prefs.tickets_assigned;
    case "tasks_mention":
      return prefs.tasks_mention;
    case "leads_followup_due":
      return prefs.leads_followup_due;
    case "leads_stale":
      return prefs.leads_stale;
    default:
      return true;
  }
};
