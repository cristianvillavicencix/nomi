import { useMessagesNotifications } from "./useMessagesNotifications";
import { useTicketsNotifications } from "./useTicketsNotifications";
import { useTasksNotifications } from "./useTasksNotifications";
import { useLeadsFollowUpNotifications } from "./useLeadsFollowUpNotifications";
import { useBookingsNotifications } from "./useBookingsNotifications";

export const AppNotificationsLayer = () => {
  useMessagesNotifications();
  useTicketsNotifications();
  useTasksNotifications();
  useLeadsFollowUpNotifications();
  useBookingsNotifications();
  return null;
};
