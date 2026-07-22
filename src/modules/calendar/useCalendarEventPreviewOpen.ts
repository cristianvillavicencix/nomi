import { useEffect, useState } from "react";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";

export const useCalendarEventPreviewOpen = (eventId: string, enabled: boolean) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    return calendarEventPreviewController.subscribe((activeId) => {
      setOpen(activeId === eventId);
    });
  }, [enabled, eventId]);

  useEffect(() => {
    if (!enabled && calendarEventPreviewController.isActive(eventId)) {
      calendarEventPreviewController.closeImmediately(eventId);
    }
  }, [enabled, eventId]);

  return open;
};
