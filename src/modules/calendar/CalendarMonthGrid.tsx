import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { CalendarEventChip } from "@/modules/calendar/CalendarEventChip";
import { CalendarEventStack } from "@/modules/calendar/CalendarEventStack";
import { CalendarMonthDayDropZone } from "@/modules/calendar/CalendarMonthDayDropZone";
import { parseCalendarDayDropId } from "@/modules/calendar/calendarEventReschedule";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";
import { groupEventsByTimeSlot } from "@/modules/calendar/calendarEventStackUtils";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
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
} from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarMonthGrid = ({
  anchor,
  eventsByDate,
  displayOptions,
  schedule,
  onSelectDay,
  onSelectEvent,
  onEditEvent,
  onRescheduleEvent,
  showAssigneeAvatars = false,
  membersById,
}: {
  anchor: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  schedule: CalendarBusinessHoursSchedule;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onRescheduleEvent?: (
    event: CalendarEvent,
    targetDateKey: string,
    targetTime?: string | null,
  ) => void | Promise<void>;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
}) => {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const dragEnabled = Boolean(onRescheduleEvent);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
        days
          .slice(index, index + 7)
          .filter((day) => isDayVisible(day, displayOptions)),
      );
    }
    return rows;
  }, [days, displayOptions]);

  const handleDragStart = (event: DragStartEvent) => {
    calendarEventPreviewController.closeImmediately();
    const dragged = event.active.data.current?.event as CalendarEvent | undefined;
    setActiveEvent(dragged ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveEvent(null);
    if (!onRescheduleEvent || !event.over) return;

    const dragged = event.active.data.current?.event as CalendarEvent | undefined;
    const targetDateKey = parseCalendarDayDropId(String(event.over.id));
    if (!dragged || !targetDateKey || dragged.date === targetDateKey) return;

    await onRescheduleEvent(dragged, targetDateKey);
  };

  const grid = (
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
              const eventGroups = groupEventsByTimeSlot(dayEvents);
              const visibleGroups = eventGroups.slice(0, 3);
              const hiddenCount = Math.max(
                dayEvents.length -
                  visibleGroups.reduce((sum, group) => sum + group.length, 0),
                0,
              );
              const inMonth = isSameMonth(day, anchor);
              const isToday = isSameDay(day, today);
              const daySchedule = schedule.getDaySchedule(day);

              return (
                <CalendarMonthDayDropZone
                  key={dateKey}
                  dateKey={dateKey}
                  enabled={dragEnabled}
                  className={cn(
                    "min-h-28 cursor-pointer border-b border-r p-2 text-left align-top transition-colors hover:bg-muted/30",
                    getWeekendCellClassName(day),
                    !inMonth && "text-muted-foreground opacity-70",
                    isToday &&
                      "bg-primary/[0.06] ring-2 ring-inset ring-primary/30",
                    daySchedule.closed &&
                      "bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(0,0,0,0.03)_6px,rgba(0,0,0,0.03)_12px)]",
                  )}
                >
                  <div
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
                    className="h-full outline-none"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs",
                          isToday &&
                            "bg-primary text-primary-foreground font-semibold",
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {daySchedule.closed ? (
                        <span className="text-[10px] text-muted-foreground">
                          Closed
                        </span>
                      ) : hiddenCount > 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{hiddenCount}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      {visibleGroups.map((group) => (
                        <CalendarEventStack
                          key={group.map((event) => event.id).join("-")}
                          events={group}
                          compact
                          fanDirection="vertical"
                          onSelectEvent={onSelectEvent}
                          onEditEvent={onEditEvent}
                          showAssigneeAvatars={showAssigneeAvatars}
                          membersById={membersById}
                          schedule={schedule}
                          enableDrag={dragEnabled}
                        />
                      ))}
                    </div>
                  </div>
                </CalendarMonthDayDropZone>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  if (!dragEnabled) return grid;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={(event) => {
        void handleDragEnd(event);
      }}
    >
      {grid}
      <DragOverlay dropAnimation={null}>
        {activeEvent ? (
          <CalendarEventChip event={activeEvent} compact static />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
