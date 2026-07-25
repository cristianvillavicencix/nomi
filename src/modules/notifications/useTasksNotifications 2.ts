import { useCallback, useEffect, useRef } from "react";
import { useGetIdentity } from "ra-core";

import type { TaskTagNotification } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { formatTaskDueDateLabel } from "@/components/atomic-crm/tasks/taskDueDateUtils";
import { TASK_DUE_DATE_NOTIFICATION_KIND } from "@/components/atomic-crm/tasks/taskDueDateNotifications";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";

const trimNotifiedIds = (notifiedIds: Set<string>) => {
  if (notifiedIds.size <= 500) return;
  const recentIds = Array.from(notifiedIds).slice(-100);
  notifiedIds.clear();
  recentIds.forEach((id) => notifiedIds.add(id));
};

export const useTasksNotifications = () => {
  const { identity } = useGetIdentity();
  const { pushNotification } = useNotificationPrefsContext();
  const notifiedIdsRef = useRef(new Set<string>());

  const isRecipient = useCallback(
    (notification: TaskTagNotification) =>
      String(notification.recipient_organization_member_id) ===
      String(identity?.id ?? ""),
    [identity?.id],
  );

  const pushTaskNotification = useCallback(
    async (notification: TaskTagNotification) => {
      const id = String(notification.id);
      if (notifiedIdsRef.current.has(id)) return;
      notifiedIdsRef.current.add(id);
      trimNotifiedIds(notifiedIdsRef.current);

      if (!isRecipient(notification)) return;

      const { data: task } = await supabase
        .from("tasks")
        .select("id, text, due_date, contact_id")
        .eq("id", notification.task_id)
        .maybeSingle();

      const title =
        notification.kind === TASK_DUE_DATE_NOTIFICATION_KIND
          ? "Task rescheduled"
          : "Task mention";
      const category =
        notification.kind === TASK_DUE_DATE_NOTIFICATION_KIND
          ? "tasks_rescheduled"
          : "tasks_mention";
      const taskTitle = task?.text?.trim() || "Task";
      const body =
        notification.kind === TASK_DUE_DATE_NOTIFICATION_KIND
          ? `${taskTitle} — due ${formatTaskDueDateLabel(task?.due_date)}`
          : taskTitle;

      pushNotification({
        category,
        title,
        body,
        tag:
          notification.kind === TASK_DUE_DATE_NOTIFICATION_KIND
            ? `task-reschedule-${notification.task_id}-${notification.id}`
            : `task-tag-${notification.id}`,
        href: "/tasks",
        desktop: true,
      });
    },
    [isRecipient, pushNotification],
  );

  useEffect(() => {
    if (!identity?.id) return;

    const channel = supabase
      .channel("task_tag_notifications_push")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_tag_notifications",
          filter: `recipient_organization_member_id=eq.${identity.id}`,
        },
        (payload) => {
          const notification = payload.new as TaskTagNotification | undefined;
          if (!notification?.id) return;
          void pushTaskNotification(notification);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "task_tag_notifications",
          filter: `recipient_organization_member_id=eq.${identity.id}`,
        },
        (payload) => {
          const notification = payload.new as TaskTagNotification | undefined;
          const previous = payload.old as TaskTagNotification | undefined;
          if (!notification?.id) return;
          if (
            notification.kind !== TASK_DUE_DATE_NOTIFICATION_KIND ||
            notification.read_at != null ||
            previous?.read_at == null
          ) {
            return;
          }
          void pushTaskNotification(notification);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, pushTaskNotification]);
};
