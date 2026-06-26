import { useCallback, useEffect, useState } from "react";

import { countUnreadInTab } from "@/modules/notifications/notificationDisplay";
import type { NotificationFilterTab } from "@/modules/notifications/notificationDisplay";
import {
  countUnreadNotificationHistory,
  getNotificationHistory,
} from "@/modules/notifications/notificationHistory";

export type NotificationUnreadCounts = Record<NotificationFilterTab, number>;

const buildCounts = (): NotificationUnreadCounts => {
  const items = getNotificationHistory();
  return {
    all: countUnreadNotificationHistory(),
    tickets: countUnreadInTab(items, "tickets"),
    leads: countUnreadInTab(items, "leads"),
    messages: countUnreadInTab(items, "messages"),
    tasks: countUnreadInTab(items, "tasks"),
    bookings: countUnreadInTab(items, "bookings"),
  };
};

export const useNotificationUnreadCounts = () => {
  const [counts, setCounts] = useState<NotificationUnreadCounts>(() => buildCounts());

  const refresh = useCallback(() => {
    setCounts(buildCounts());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("nomi:notifications-updated", handler);
    return () => window.removeEventListener("nomi:notifications-updated", handler);
  }, [refresh]);

  return counts;
};
