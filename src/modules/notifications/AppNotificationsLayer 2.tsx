import { useNotificationPrefsContextOptional } from "./NotificationPrefsContext";
import { useMessagesNotifications } from "./useMessagesNotifications";
import { useTicketsNotifications } from "./useTicketsNotifications";
import { useTasksNotifications } from "./useTasksNotifications";
import { useLeadsFollowUpNotifications } from "./useLeadsFollowUpNotifications";
import { useBookingsNotifications } from "./useBookingsNotifications";

/**
 * Subscribes to realtime notification sources. Must sit under
 * NotificationPrefsProvider + MessagesQuickAccessProvider.
 * Renders nothing when prefs context is missing (avoids white-screen on remount/HMR).
 */
export const AppNotificationsLayer = () => {
  const prefs = useNotificationPrefsContextOptional();
  if (!prefs) return null;
  return <AppNotificationsSubscriptions />;
};

const AppNotificationsSubscriptions = () => {
  useMessagesNotifications();
  useTicketsNotifications();
  useTasksNotifications();
  useLeadsFollowUpNotifications();
  useBookingsNotifications();
  return null;
};
