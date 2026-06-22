import { useCallback, useEffect, useRef } from "react";
import { useGetIdentity } from "ra-core";

import type { TaskTagNotification } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
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

  const notifyMention = useCallback(
    async (notification: TaskTagNotification) => {
      const id = String(notification.id);
      if (notifiedIdsRef.current.has(id)) return;
      notifiedIdsRef.current.add(id);
      trimNotifiedIds(notifiedIdsRef.current);

      if (
        String(notification.recipient_organization_member_id) !==
        String(identity?.id ?? "")
      ) {
        return;
      }

      const { data: task } = await supabase
        .from("tasks")
        .select("id, text, contact_id")
        .eq("id", notification.task_id)
        .maybeSingle();

      const body = task?.text?.trim() || "You were mentioned on a task";

      pushNotification({
        category: "tasks_mention",
        title: "Task mention",
        body,
        tag: `task-tag-${notification.id}`,
        href: "/tasks",
        desktop: true,
      });
    },
    [identity?.id, pushNotification],
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
          void notifyMention(notification);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, notifyMention]);
};
