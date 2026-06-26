import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  getMonthGridDays,
  getWeekdayLabel,
  isSameDay,
  isSameMonth,
  toDateKey,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { CalendarEventChip } from "@/modules/calendar/CalendarEventChip";
import { WORK_CATEGORY_OPTIONS } from "@/modules/work/workCategoryUtils";
import { cn } from "@/lib/utils";

const WorkCompactMonthGrid = ({
  anchor,
  selectedDateKey,
  dotsByDate,
  onSelectDay,
}: {
  anchor: Date;
  selectedDateKey: string;
  dotsByDate: Record<string, string[]>;
  onSelectDay: (dateKey: string) => void;
}) => {
  const days = getMonthGridDays(anchor);
  const today = new Date();
  const headerDays = days.slice(0, 7);
  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [days]);

  return (
    <div className="overflow-hidden rounded-sm border">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {headerDays.map((day) => (
          <div
            key={toDateKey(day)}
            className="px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground"
          >
            {getWeekdayLabel(day)}
          </div>
        ))}
      </div>
      <div>
        {weekRows.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day) => {
              const dateKey = toDateKey(day);
              const dots = dotsByDate[dateKey] ?? [];
              const inMonth = isSameMonth(day, anchor);
              const isToday = isSameDay(day, today);
              const isSelected = dateKey === selectedDateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => onSelectDay(dateKey)}
                  className={cn(
                    "flex min-h-[42px] flex-col items-center gap-0.5 border-b border-r px-1 py-1 text-xs transition-colors last:border-r-0",
                    !inMonth && "text-muted-foreground/50",
                    isSelected && "bg-primary/5",
                    isToday && "font-semibold",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="flex h-2 items-center gap-0.5">
                    {dots.slice(0, 3).map((dotClass, index) => (
                      <span
                        key={index}
                        className={cn("size-1.5 rounded-full", dotClass)}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const WorkSidebarPanel = ({
  anchor,
  onAnchorChange,
  eventsByDate,
  groupedCounts,
  onSelectEvent,
}: {
  anchor: Date;
  onAnchorChange: (next: Date) => void;
  eventsByDate: Record<string, CalendarEvent[]>;
  groupedCounts: { overdue: number; today: number };
  onSelectEvent: (event: CalendarEvent) => void;
}) => {
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );

  const dotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [dateKey, events] of Object.entries(eventsByDate)) {
      map[dateKey] = events.slice(0, 3).map((event) => {
        const category =
          event.kind === "meeting"
            ? "meeting"
            : event.kind === "project_delivery"
              ? "delivery"
              : event.kind === "activity"
                ? "activity"
                : event.kind === "reminder"
                  ? "follow_up"
                  : "task";
        return (
          WORK_CATEGORY_OPTIONS.find((entry) => entry.value === category)
            ?.dotClass ?? "bg-muted-foreground/50"
        );
      });
    }
    return map;
  }, [eventsByDate]);

  const selectedEvents = eventsByDate[selectedDateKey] ?? [];

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{formatMonthLabel(anchor)}</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onAnchorChange(addMonths(anchor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onAnchorChange(addMonths(anchor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <WorkCompactMonthGrid
        anchor={anchor}
        selectedDateKey={selectedDateKey}
        dotsByDate={dotsByDate}
        onSelectDay={setSelectedDateKey}
      />

      <div className="min-h-0 flex-1 space-y-2">
        <h3 className="text-sm font-semibold">
          {formatDayLabel(selectedDateKey)}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2 overflow-y-auto pr-1">
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onSelectEvent(event)}
                >
                  <CalendarEventChip event={event} static />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Overdue</span>
          <span className="font-medium tabular-nums">
            {groupedCounts.overdue}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Today</span>
          <span className="font-medium tabular-nums">
            {groupedCounts.today}
          </span>
        </div>
      </div>
    </aside>
  );
};
