import { useMemo } from "react";
import { CalendarEventChip } from "@/modules/calendar/CalendarEventChip";
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
} from "@/modules/calendar/calendarUtils";
import {
  formatMinutesAsTime,
  getCurrentTimeIndicator,
  getHourLabels,
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOUR_SLOT_HEIGHT_PX,
  layoutTimedEvents,
  splitTimedAndUntimedEvents,
} from "@/modules/calendar/calendarTimeGridUtils";
import { cn } from "@/lib/utils";

const TOTAL_GRID_HEIGHT =
  (GRID_END_HOUR - GRID_START_HOUR) * HOUR_SLOT_HEIGHT_PX;

export const CalendarTimeWeekGrid = ({
  anchor,
  eventsByDate,
  displayOptions,
  selectedDateKey,
  onSelectDay,
  onSelectEvent,
  onSelectSlot,
}: {
  anchor: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  selectedDateKey?: string | null;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (dateKey: string, time: string) => void;
}) => {
  const today = new Date();
  const todayKey = toDateKey(today);
  const columnCount = getVisibleColumnCount(displayOptions);
  const gridColsClass = GRID_COLUMN_CLASS[columnCount];
  const hourLabels = getHourLabels();
  const nowIndicator = getCurrentTimeIndicator(today);

  const days = useMemo(
    () =>
      getWeekDays(anchor).filter((day) => isDayVisible(day, displayOptions)),
    [anchor, displayOptions],
  );

  const dayLayouts = useMemo(
    () =>
      days.map((day) => {
        const dateKey = toDateKey(day);
        const dayEvents = eventsByDate[dateKey] ?? [];
        const { timed, untimed } = splitTimedAndUntimedEvents(dayEvents);
        return {
          dateKey,
          day,
          untimed,
          timedBlocks: layoutTimedEvents(timed),
        };
      }),
    [days, eventsByDate],
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className={cn("grid border-b bg-muted/40", gridColsClass)}
        style={{ gridTemplateColumns: undefined }}
      >
        <div className="border-r bg-muted/40" aria-hidden />
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDateKey === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(dateKey)}
              className={cn(
                "px-1.5 py-2 text-center transition-colors hover:bg-muted/30",
                getWeekendCellClassName(day),
                isSelected && "bg-primary/5",
              )}
            >
              <div className="text-[11px] text-muted-foreground">
                {getWeekdayLabel(day)}
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

      <div className="flex">
        <div
          className="w-14 shrink-0 border-r bg-muted/20"
          style={{ height: TOTAL_GRID_HEIGHT }}
        >
          {hourLabels.map((label, index) => (
            <div
              key={label}
              className="relative border-b border-border/60 px-1 text-[10px] text-muted-foreground"
              style={{ height: HOUR_SLOT_HEIGHT_PX }}
            >
              <span
                className={cn(
                  "absolute -top-2 right-1 tabular-nums",
                  index === 0 && "top-1",
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className={cn("grid min-w-0 flex-1", gridColsClass)}>
          {dayLayouts.map(({ dateKey, day, untimed, timedBlocks }) => {
            const isToday = dateKey === todayKey;

            return (
              <div
                key={dateKey}
                className={cn(
                  "relative border-r last:border-r-0",
                  getWeekendCellClassName(day),
                )}
                style={{ height: TOTAL_GRID_HEIGHT }}
              >
                {untimed.length > 0 ? (
                  <div className="absolute inset-x-0 top-0 z-20 space-y-0.5 border-b bg-background/95 p-1">
                    {untimed.map((event) => (
                      <CalendarEventChip
                        key={event.id}
                        event={event}
                        compact
                        onClick={onSelectEvent}
                      />
                    ))}
                  </div>
                ) : null}

                {Array.from({
                  length: GRID_END_HOUR - GRID_START_HOUR,
                }).map((_, hourIndex) => (
                  <button
                    key={hourIndex}
                    type="button"
                    className="absolute inset-x-0 border-b border-border/40 transition-colors hover:bg-primary/5"
                    style={{
                      top: hourIndex * HOUR_SLOT_HEIGHT_PX,
                      height: HOUR_SLOT_HEIGHT_PX,
                    }}
                    onClick={() => {
                      const minutes =
                        (GRID_START_HOUR + hourIndex) * 60;
                      onSelectSlot?.(
                        dateKey,
                        formatMinutesAsTime(minutes),
                      );
                    }}
                    aria-label={`Add event at ${hourLabels[hourIndex]}`}
                  />
                ))}

                {timedBlocks.map(({ event, topPx, heightPx }) => (
                  <div
                    key={event.id}
                    className="absolute inset-x-1 z-10 overflow-hidden"
                    style={{ top: topPx, height: heightPx }}
                  >
                    <CalendarEventChip
                      event={event}
                      onClick={onSelectEvent}
                    />
                  </div>
                ))}

                {isToday && nowIndicator ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30"
                    style={{ top: nowIndicator.topPx }}
                  >
                    <div className="relative flex items-center">
                      <span className="absolute -left-1 size-2 rounded-full bg-red-500" />
                      <div className="h-px flex-1 border-t border-dashed border-red-500" />
                      <span className="ml-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                        {nowIndicator.label}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
