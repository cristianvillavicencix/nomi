import { useMemo } from "react";
import { CalendarEventChip } from "@/lbs/calendar/CalendarEventChip";
import {
  GRID_COLUMN_CLASS,
  getVisibleColumnCount,
  getWeekDays,
  getWeekdayLabel,
  getWeekendCellClassName,
  isDayVisible,
  isSameDay,
  toDateKey,
  type CalendarDisplayOptions,
  type CalendarEvent,
} from "@/lbs/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarWeekGrid = ({
  anchor,
  eventsByDate,
  displayOptions,
  onSelectDay,
  onSelectEvent,
}: {
  anchor: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) => {
  const today = new Date();
  const columnCount = getVisibleColumnCount(displayOptions);
  const gridColsClass = GRID_COLUMN_CLASS[columnCount];

  const days = useMemo(
    () =>
      getWeekDays(anchor).filter((day) => isDayVisible(day, displayOptions)),
    [anchor, displayOptions],
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className={cn("grid border-b bg-muted/40", gridColsClass)}>
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const weekdayLabel = getWeekdayLabel(day);

          return (
            <button
              key={toDateKey(day)}
              type="button"
              onClick={() => onSelectDay(toDateKey(day))}
              className={cn(
                "px-1.5 py-2 text-center transition-colors hover:bg-muted/30",
                getWeekendCellClassName(day),
              )}
            >
              <div className="text-[11px] text-muted-foreground">
                {weekdayLabel}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      <div className={cn("grid min-h-[420px]", gridColsClass)}>
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const dayEvents = eventsByDate[dateKey] ?? [];

          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(dateKey)}
              onKeyDown={(keyboardEvent) => {
                if (
                  keyboardEvent.key === "Enter" ||
                  keyboardEvent.key === " "
                ) {
                  keyboardEvent.preventDefault();
                  onSelectDay(dateKey);
                }
              }}
              className={cn(
                "cursor-pointer space-y-1 border-r p-2 transition-colors last:border-r-0 hover:bg-muted/30",
                getWeekendCellClassName(day),
              )}
            >
              {dayEvents.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">
                  Add task or event
                </p>
              ) : (
                dayEvents.map((event) => (
                  <CalendarEventChip
                    key={event.id}
                    event={event}
                    onClick={onSelectEvent}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
