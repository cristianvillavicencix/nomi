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
import { CalendarEventStack, CalendarTimedEventStack } from "@/modules/calendar/CalendarEventStack";
import { CalendarWeekHourDropZone } from "@/modules/calendar/CalendarWeekHourDropZone";
import { parseCalendarDropTarget } from "@/modules/calendar/calendarEventReschedule";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";
import { groupEventsByTimeSlot, groupTimedBlocksByStart } from "@/modules/calendar/calendarEventStackUtils";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
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
  computeHourOccupancy,
  getOccupancyBackgroundClass,
} from "@/modules/calendar/calendarOccupancy";
import {
  formatMinutesAsTime,
  getCurrentTimeIndicator,
  getHourLabels,
  HOUR_SLOT_HEIGHT_PX,
  layoutTimedEvents,
  splitTimedAndUntimedEvents,
} from "@/modules/calendar/calendarTimeGridUtils";
import { cn } from "@/lib/utils";

export const CalendarTimeWeekGrid = ({
  anchor,
  eventsByDate,
  displayOptions,
  schedule,
  selectedDateKey,
  onSelectDay,
  onSelectEvent,
  onEditEvent,
  onSelectSlot,
  onRescheduleEvent,
  showAssigneeAvatars = false,
  membersById,
}: {
  anchor: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  schedule: CalendarBusinessHoursSchedule;
  selectedDateKey?: string | null;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (dateKey: string, time: string) => void;
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

  const today = new Date();
  const todayKey = toDateKey(today);
  const gridStartHour = schedule.gridStartHour;
  const gridEndHour = schedule.gridEndHour;
  const totalGridHeight = (gridEndHour - gridStartHour) * HOUR_SLOT_HEIGHT_PX;
  const columnCount = getVisibleColumnCount(displayOptions);
  const gridColsClass = GRID_COLUMN_CLASS[columnCount];
  const hourLabels = getHourLabels(gridStartHour, gridEndHour);
  const nowIndicator = getCurrentTimeIndicator(today, {
    startHour: gridStartHour,
    endHour: gridEndHour,
  });

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
        const daySchedule = schedule.getDaySchedule(day);
        const { timed, untimed } = splitTimedAndUntimedEvents(dayEvents);
        return {
          dateKey,
          day,
          daySchedule,
          untimed,
          timedBlocks: groupTimedBlocksByStart(
            layoutTimedEvents(timed, {
              startHour: gridStartHour,
              endHour: gridEndHour,
            }),
          ),
          occupancy: computeHourOccupancy({
            events: dayEvents,
            startHour: gridStartHour,
            endHour: gridEndHour,
          }),
        };
      }),
    [days, eventsByDate, gridEndHour, gridStartHour, schedule],
  );

  const handleDragStart = (event: DragStartEvent) => {
    calendarEventPreviewController.closeImmediately();
    const dragged = event.active.data.current?.event as CalendarEvent | undefined;
    setActiveEvent(dragged ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveEvent(null);
    if (!onRescheduleEvent || !event.over) return;

    const dragged = event.active.data.current?.event as CalendarEvent | undefined;
    const target = parseCalendarDropTarget(String(event.over.id));
    if (!dragged || !target) return;

    await onRescheduleEvent(
      dragged,
      target.dateKey,
      target.time,
    );
  };

  const grid = (
    <div className="overflow-hidden rounded-lg border">
      <div className={cn("grid border-b bg-muted/40", gridColsClass)}>
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
                isToday &&
                  "bg-primary/[0.06] ring-2 ring-inset ring-primary/30",
                isSelected && !isToday && "bg-primary/5",
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
          style={{ height: totalGridHeight }}
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
          {dayLayouts.map(
            ({ dateKey, day, daySchedule, untimed, timedBlocks, occupancy }) => {
              const isToday = dateKey === todayKey;

              if (daySchedule.closed) {
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "relative flex items-center justify-center border-r bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(0,0,0,0.04)_6px,rgba(0,0,0,0.04)_12px)] text-xs font-medium text-muted-foreground last:border-r-0 dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(255,255,255,0.04)_6px,rgba(255,255,255,0.04)_12px)]",
                      getWeekendCellClassName(day),
                    )}
                    style={{ height: totalGridHeight }}
                  >
                    Closed
                  </div>
                );
              }

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "relative border-r last:border-r-0",
                    getWeekendCellClassName(day),
                    isToday &&
                      "bg-primary/[0.04] ring-2 ring-inset ring-primary/20",
                  )}
                  style={{ height: totalGridHeight }}
                >
                  {untimed.length > 0 ? (
                    <div className="absolute inset-x-0 top-0 z-20 space-y-0.5 border-b bg-background/95 p-1">
                      {groupEventsByTimeSlot(untimed).map((group) => (
                        <CalendarEventStack
                          key={group.map((event) => event.id).join("-")}
                          events={group}
                          compact
                          fanDirection="horizontal"
                          onSelectEvent={onSelectEvent}
                          onEditEvent={onEditEvent}
                          showAssigneeAvatars={showAssigneeAvatars}
                          membersById={membersById}
                          schedule={schedule}
                          enableDrag={dragEnabled}
                        />
                      ))}
                    </div>
                  ) : null}

                  {Array.from({ length: gridEndHour - gridStartHour }).map(
                    (_, hourIndex) => {
                      const hour = gridStartHour + hourIndex;
                      const slotTime = formatMinutesAsTime(hour * 60);
                      const withinDay =
                        hour >= daySchedule.startHour &&
                        hour < daySchedule.endHour;
                      const occupancyClass = getOccupancyBackgroundClass(
                        occupancy[hourIndex]?.ratio ?? 0,
                      );

                      return (
                        <CalendarWeekHourDropZone
                          key={hourIndex}
                          dateKey={dateKey}
                          time={slotTime}
                          enabled={dragEnabled && withinDay}
                          disabled={!withinDay}
                          className={cn(
                            "absolute inset-x-0 border-b border-border/40 transition-colors",
                            withinDay
                              ? cn("hover:bg-primary/5", occupancyClass)
                              : "cursor-not-allowed bg-muted/20",
                          )}
                          style={{
                            top: hourIndex * HOUR_SLOT_HEIGHT_PX,
                            height: HOUR_SLOT_HEIGHT_PX,
                          }}
                          onClick={() => {
                            if (!withinDay) return;
                            onSelectSlot?.(dateKey, slotTime);
                          }}
                          aria-label={`Add event at ${hourLabels[hourIndex]}`}
                        />
                      );
                    },
                  )}

                  {timedBlocks.map((blockGroup) => (
                    <CalendarTimedEventStack
                      key={blockGroup.map((block) => block.event.id).join("-")}
                      blocks={blockGroup}
                      onSelectEvent={onSelectEvent}
                      onEditEvent={onEditEvent}
                      showAssigneeAvatars={showAssigneeAvatars}
                      membersById={membersById}
                      schedule={schedule}
                      enableDrag={dragEnabled}
                    />
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
            },
          )}
        </div>
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
