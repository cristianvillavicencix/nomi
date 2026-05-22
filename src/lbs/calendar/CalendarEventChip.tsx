import type { CalendarEvent } from "@/lbs/calendar/calendarUtils";
import {
  getEventClassName,
  getEventLabel,
} from "@/lbs/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarEventChip = ({
  event,
  compact = false,
  onClick,
  static: isStatic = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  static?: boolean;
}) => {
  const className = cn(
    "block w-full truncate rounded border px-1.5 text-left text-[11px] font-medium leading-5 transition-opacity",
    compact ? "py-0" : "py-0.5",
    onClick && !isStatic && "hover:opacity-80",
    getEventClassName(event),
  );
  const label = getEventLabel(event);

  if (isStatic || !onClick) {
    return (
      <div className={className} title={label}>
        {label}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={className}
      title={label}
    >
      {label}
    </button>
  );
};
