import { useCallback } from "react";
import {
  useDataProvider,
  useNotify,
  useRefresh,
  useUpdate,
  type NotificationOptions,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildCalendarEventReschedulePayload,
  buildTaskRescheduleDueDate,
  canRescheduleCalendarEvent,
  getRescheduleSuccessMessage,
  hasRescheduleTargetChanged,
} from "@/modules/calendar/calendarEventReschedule";
import { sendCalendarEventUpdateNotifications } from "@/modules/calendar/sendCalendarEventUpdateNotifications";
import {
  isCalendarEntryEvent,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { DEFAULT_MEETING_NOTIFICATION_SETTINGS } from "@/modules/meetings/meetingNotificationSettings";

export const useCalendarEventReschedule = () => {
  const [update] = useUpdate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();

  const rescheduleEvent = useCallback(
    async (
      event: CalendarEvent,
      targetDateKey: string,
      targetTime?: string | null,
    ) => {
      if (!canRescheduleCalendarEvent(event)) {
        notify("This item cannot be moved from the calendar", {
          type: "warning",
        });
        return;
      }

      if (!hasRescheduleTargetChanged(event, targetDateKey, targetTime)) {
        return;
      }

      const afterOptimisticUpdate = () => {
        refresh();
      };

      try {
        if (event.kind === "task") {
          const task = event.task;
          const previousData = { ...task };
          update(
            "tasks",
            {
              id: task.id,
              data: {
                due_date: buildTaskRescheduleDueDate(
                  task,
                  targetDateKey,
                  targetTime,
                ),
              },
              previousData,
            },
            {
              mutationMode: "undoable",
              onSuccess: afterOptimisticUpdate,
            },
          );
        } else if (isCalendarEntryEvent(event)) {
          const previous = { ...event.record };
          const payload = buildCalendarEventReschedulePayload(
            previous,
            targetDateKey,
            targetTime,
          );
          const updatedSnapshot = {
            ...previous,
            ...payload,
            event_date: targetDateKey,
          };

          update(
            "calendar_events",
            {
              id: previous.id,
              data: payload,
              previousData: previous,
            },
            {
              mutationMode: "undoable",
              onSuccess: afterOptimisticUpdate,
              onSettled: async (_data, error) => {
                if (error) return;

                const { warnings } = await sendCalendarEventUpdateNotifications(
                  {
                    previous,
                    updated: updatedSnapshot,
                    dataProvider,
                    notify: (message, options) =>
                      notify(message, options as NotificationOptions),
                    shareEmail:
                      DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_email_default,
                    shareSms:
                      DEFAULT_MEETING_NOTIFICATION_SETTINGS.client_invite_sms_default,
                  },
                );
                if (warnings.length > 0) {
                  notify(warnings.join(". "), { type: "warning" });
                }
              },
            },
          );
        } else {
          return;
        }

        notify(getRescheduleSuccessMessage(event, targetDateKey, targetTime), {
          type: "info",
          undoable: true,
        });
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Could not reschedule item",
          { type: "error" },
        );
      }
    },
    [dataProvider, notify, refresh, update],
  );

  return { rescheduleEvent };
};
