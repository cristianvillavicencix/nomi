import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { getCalendarDayDropId } from "@/modules/calendar/calendarEventReschedule";
import { cn } from "@/lib/utils";

export const CalendarMonthDayDropZone = ({
  dateKey,
  enabled,
  className,
  children,
}: {
  dateKey: string;
  enabled: boolean;
  className?: string;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: getCalendarDayDropId(dateKey),
    data: { dateKey },
    disabled: !enabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        enabled && isOver && "bg-primary/10 ring-2 ring-inset ring-primary/40",
      )}
    >
      {children}
    </div>
  );
};
