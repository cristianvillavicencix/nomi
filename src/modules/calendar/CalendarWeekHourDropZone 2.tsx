import type { CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import { getCalendarSlotDropId } from "@/modules/calendar/calendarEventReschedule";
import { cn } from "@/lib/utils";

export const CalendarWeekHourDropZone = ({
  dateKey,
  time,
  enabled,
  className,
  style,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  dateKey: string;
  time: string;
  enabled: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: getCalendarSlotDropId(dateKey, time),
    data: { dateKey, time },
    disabled: !enabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      className={cn(
        className,
        enabled && isOver && "bg-primary/10 ring-2 ring-inset ring-primary/40",
      )}
      style={style}
      onClick={onClick}
      aria-label={ariaLabel}
    />
  );
};
