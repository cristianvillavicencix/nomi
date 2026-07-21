import type { NotificationCategory, NotificationPrefs } from "./types";

export type NotificationCapabilityId =
  | "messaging.conversations.view"
  | "support.tickets.view"
  | "crm.tasks.view"
  | "crm.contacts.view"
  | "meetings.manage";

export const NOTIFICATION_CATEGORY_CAPABILITY: Record<
  NotificationCategory,
  NotificationCapabilityId
> = {
  messages_sms: "messaging.conversations.view",
  messages_internal: "messaging.conversations.view",
  tickets_message: "support.tickets.view",
  tickets_assigned: "support.tickets.view",
  tasks_mention: "crm.tasks.view",
  tasks_rescheduled: "crm.tasks.view",
  leads_followup_due: "crm.contacts.view",
  leads_stale: "crm.contacts.view",
  bookings_new: "meetings.manage",
};

export const NOTIFICATION_CATEGORY_GROUPS: {
  title: string;
  keys: NotificationCategory[];
}[] = [
  {
    title: "Messages",
    keys: ["messages_sms", "messages_internal"],
  },
  {
    title: "Tickets",
    keys: ["tickets_message", "tickets_assigned"],
  },
  {
    title: "Tasks",
    keys: ["tasks_mention", "tasks_rescheduled"],
  },
  {
    title: "Leads",
    keys: ["leads_followup_due", "leads_stale"],
  },
  {
    title: "Bookings",
    keys: ["bookings_new"],
  },
];

export const prefsKeyForCategory = (
  category: NotificationCategory,
): keyof NotificationPrefs => category;

export const canAccessNotificationCategory = (
  category: NotificationCategory,
  hasCapability: (id: string) => boolean,
): boolean => hasCapability(NOTIFICATION_CATEGORY_CAPABILITY[category]);

export const filterNotificationCategoryGroups = (
  hasCapability: (id: string) => boolean,
) =>
  NOTIFICATION_CATEGORY_GROUPS.map((group) => ({
    ...group,
    keys: group.keys.filter((key) =>
      canAccessNotificationCategory(key, hasCapability),
    ),
  })).filter((group) => group.keys.length > 0);

export const sanitizeNotificationPrefsForCapabilities = (
  prefs: NotificationPrefs,
  hasCapability: (id: string) => boolean,
): NotificationPrefs => {
  const next = { ...prefs };
  for (const category of Object.keys(
    NOTIFICATION_CATEGORY_CAPABILITY,
  ) as NotificationCategory[]) {
    if (!canAccessNotificationCategory(category, hasCapability)) {
      next[prefsKeyForCategory(category)] = false;
    }
  }
  return next;
};
