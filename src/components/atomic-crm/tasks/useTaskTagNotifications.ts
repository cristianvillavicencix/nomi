import { useGetList, useUpdate, type Identifier } from "ra-core";
import type { TaskTagNotification } from "@/components/atomic-crm/types";

export const useUnreadTaskTagNotifications = (
  organizationMemberId?: Identifier | null,
) => {
  const query = useGetList<TaskTagNotification>(
    "task_tag_notifications",
    {
      filter: {
        recipient_organization_member_id: organizationMemberId,
        "read_at@is": null,
      },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: organizationMemberId != null, staleTime: 15_000 },
  );

  return {
    notifications: query.data ?? [],
    total: query.total ?? 0,
    isPending: query.isPending,
    refetch: query.refetch,
  };
};

export const useMarkTaskTagNotificationsRead = () => {
  const [update] = useUpdate();

  const markRead = async (notifications: TaskTagNotification[]) => {
    if (notifications.length === 0) return;

    await Promise.all(
      notifications.map((notification) =>
        update(
          "task_tag_notifications",
          {
            id: notification.id,
            data: { read_at: new Date().toISOString() },
            previousData: notification,
          },
          { returnPromise: true },
        ),
      ),
    );
  };

  return { markRead };
};
