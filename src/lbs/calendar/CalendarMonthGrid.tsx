import { useMemo } from "react";
import { CalendarEventChip } from "@/lbs/calendar/CalendarEventChip";
import {
  GRID_COLUMN_CLASS,
  getMonthGridDays,
  getVisibleColumnCount,
  getWeekdayLabel,
  getWeekendCellClassName,
  isDayVisible,
  isSameDay,
  isSameMonth,
  toDateKey,
  type CalendarDisplayOptions,
  type CalendarEvent,
} from "@/lbs/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarMonthGrid = ({
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
  const days = getMonthGridDays(anchor);
  const today = new Date();
  const columnCount = getVisibleColumnCount(displayOptions);
  const gridColsClass = GRID_COLUMN_CLASS[columnCount];

  const headerDays = useMemo(
    () => days.slice(0, 7).filter((day) => isDayVisible(day, displayOptions)),
    [days, displayOptions],
  );

  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(
        days.slice(index, index + 7).filter((day) => isDayVisible(day, displayOptions)),
      );
    }
    return rows;
  }, [days, displayOptions]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className={cn("grid border-b bg-muted/40", gridColsClass)}>
        {headerDays.map((day) => (
          <div
            key={toDateKey(day)}
            className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground"
          >
            {getWeekdayLabel(day)}
          </div>
        ))}
      </div>

      <div>
        {weekRows.map((week, weekIndex) => (
          <div key={weekIndex} className={cn("grid", gridColsClass)}>
            {week.map((day) => {
              const dateKey = toDateKey(day);
              const dayEvents = eventsByDate[dateKey] ?? [];
              const visibleEvents = dayEvents.slice(0, 3);
              const hiddenCount = Math.max(dayEvents.length - visibleEvents.length, 0);
              const inMonth = isSameMonth(day, anchor);
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDay(dateKey)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      onSelectDay(dateKey);
                    }
                  }}
                  className={cn(
                    "min-h-28 cursor-pointer border-b border-r p-2 text-left align-top transition-colors hover:bg-muted/30",
                    getWeekendCellClassName(day),
                    !inMonth && "text-muted-foreground opacity-70",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs",
                        isToday && "bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {hiddenCount > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        +{hiddenCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {visibleEvents.map((event) => (
                      <CalendarEventChip
                        key={event.id}
                        event={event}
                        compact
                        onClick={onSelectEvent}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
