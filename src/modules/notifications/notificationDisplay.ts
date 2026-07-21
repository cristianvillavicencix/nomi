import {
  AlertCircle,
  Bell,
  CalendarCheck,
  CheckSquare,
  Clock,
  MessageSquare,
  MessagesSquare,
  Smartphone,
  Ticket,
  type LucideIcon,
} from "lucide-react";

import type {
  NotificationCategory,
  NotificationHistoryItem,
} from "@/modules/notifications/types";

export type NotificationFilterTab =
  | "all"
  | "tickets"
  | "leads"
  | "messages"
  | "tasks"
  | "bookings";

export const NOTIFICATION_FILTER_TABS: {
  id: NotificationFilterTab;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "bookings", label: "Bookings" },
  { id: "tickets", label: "Tickets" },
  { id: "leads", label: "Leads" },
  { id: "messages", label: "Messages" },
  { id: "tasks", label: "Tasks" },
];

const TAB_CATEGORIES: Record<
  Exclude<NotificationFilterTab, "all">,
  NotificationCategory[]
> = {
  bookings: ["bookings_new"],
  tickets: ["tickets_message", "tickets_assigned"],
  leads: ["leads_followup_due", "leads_stale"],
  messages: ["messages_sms", "messages_internal"],
  tasks: ["tasks_mention", "tasks_rescheduled"],
};

export const NOTIFICATION_CATEGORY_ICONS: Record<
  NotificationCategory,
  LucideIcon
> = {
  messages_sms: Smartphone,
  messages_internal: MessagesSquare,
  tickets_message: MessageSquare,
  tickets_assigned: Ticket,
  tasks_mention: CheckSquare,
  tasks_rescheduled: Clock,
  leads_followup_due: Clock,
  leads_stale: AlertCircle,
  bookings_new: CalendarCheck,
};

export const NOTIFICATION_CATEGORY_ACCENT: Record<
  NotificationCategory,
  string
> = {
  messages_sms: "text-emerald-600 bg-emerald-500/10",
  messages_internal: "text-sky-600 bg-sky-500/10",
  tickets_message: "text-violet-600 bg-violet-500/10",
  tickets_assigned: "text-amber-600 bg-amber-500/10",
  tasks_mention: "text-blue-600 bg-blue-500/10",
  tasks_rescheduled: "text-indigo-600 bg-indigo-500/10",
  leads_followup_due: "text-orange-600 bg-orange-500/10",
  leads_stale: "text-rose-600 bg-rose-500/10",
  bookings_new: "text-teal-600 bg-teal-500/10",
};

export const filterNotificationsByTab = (
  items: NotificationHistoryItem[],
  tab: NotificationFilterTab,
) => {
  if (tab === "all") return items;
  const allowed = new Set(TAB_CATEGORIES[tab]);
  return items.filter((item) => allowed.has(item.category));
};

const normalizeNotificationBody = (body: string) => body.trim().toLowerCase();

const groupKey = (item: NotificationHistoryItem) => {
  const body = item.body.trim();
  if (item.category === "tickets_assigned" && body) {
    return `tickets_assigned::body::${normalizeNotificationBody(body)}`;
  }
  return `${item.category}::${item.href ?? body}`;
};

export type GroupedNotification = {
  key: string;
  latest: NotificationHistoryItem;
  items: NotificationHistoryItem[];
  count: number;
  unreadCount: number;
  /** Multiple ticket assignments sharing the same address/subject line. */
  isAddressAssignmentGroup: boolean;
};

export const groupNotificationsForDisplay = (
  items: NotificationHistoryItem[],
): GroupedNotification[] => {
  const groups = new Map<string, GroupedNotification>();

  for (const item of items) {
    const key = groupKey(item);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        latest: item,
        items: [item],
        count: 1,
        unreadCount: item.read ? 0 : 1,
        isAddressAssignmentGroup:
          item.category === "tickets_assigned" && item.body.trim().length > 0,
      });
      continue;
    }

    existing.items.push(item);
    existing.count += 1;
    if (!item.read) existing.unreadCount += 1;

    if (new Date(item.created_at) > new Date(existing.latest.created_at)) {
      existing.latest = item;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      ),
      isAddressAssignmentGroup:
        group.isAddressAssignmentGroup && group.count > 1,
    }))
    .sort(
      (a, b) =>
        new Date(b.latest.created_at).getTime() -
        new Date(a.latest.created_at).getTime(),
    );
};

export const countUnreadInTab = (
  items: NotificationHistoryItem[],
  tab: NotificationFilterTab,
) => filterNotificationsByTab(items, tab).filter((item) => !item.read).length;

export const DefaultNotificationIcon = Bell;
