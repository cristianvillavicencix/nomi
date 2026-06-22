import { useMessagesNotifications } from "./useMessagesNotifications";
import { useTicketsNotifications } from "./useTicketsNotifications";
import { useTasksNotifications } from "./useTasksNotifications";
import { useLeadsFollowUpNotifications } from "./useLeadsFollowUpNotifications";

export const AppNotificationsLayer = () => {
  useMessagesNotifications();
  useTicketsNotifications();
  useTasksNotifications();
  useLeadsFollowUpNotifications();
  return null;
};
