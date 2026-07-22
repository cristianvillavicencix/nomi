import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { CalendarEventStack, CalendarTimedEventStack } from "@/modules/calendar/CalendarEventStack";
import { groupEventsByTimeSlot, groupTimedBlocksByStart } from "@/modules/calendar/calendarEventStackUtils";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
import {
  formatMinutesAsTime,
  getCurrentTimeIndicator,
  getHourLabels,
  HOUR_SLOT_HEIGHT_PX,
  layoutTimedEvents,
  splitTimedAndUntimedEvents,
} from "@/modules/calendar/calendarTimeGridUtils";
import {
  formatDayLabel,
  toDateKey,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import {
  computeHourOccupancy,
  getOccupancyBackgroundClass,
} from "@/modules/calendar/calendarOccupancy";
import { cn } from "@/lib/utils";

export const CalendarDayPanel = ({
  dateKey,
  events,
  schedule,
  open,
  onClose,
  onSelectEvent,
  onEditEvent,
  onSelectSlot,
  onAddEvent,
  showAssigneeAvatars = false,
  membersById,
}: {
  dateKey: string;
  events: CalendarEvent[];
  schedule: CalendarBusinessHoursSchedule;
  open: boolean;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (dateKey: string, time: string) => void;
  onAddEvent: (dateKey: string) => void;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
}) => {
  const daySchedule = schedule.getDaySchedule(dateKey);
  const gridStartHour = schedule.gridStartHour;
  const gridEndHour = schedule.gridEndHour;
  const totalHeight = (gridEndHour - gridStartHour) * HOUR_SLOT_HEIGHT_PX;
  const hourLabels = getHourLabels(gridStartHour, gridEndHour);
  const { timed, untimed } = splitTimedAndUntimedEvents(events);
  const timedBlockGroups = groupTimedBlocksByStart(
    layoutTimedEvents(timed, {
      startHour: gridStartHour,
      endHour: gridEndHour,
    }),
  );
  const isToday = dateKey === toDateKey(new Date());
  const nowIndicator = isToday
    ? getCurrentTimeIndicator(new Date(), {
        startHour: gridStartHour,
        endHour: gridEndHour,
      })
    : null;
  const occupancy = useMemo(
    () =>
      computeHourOccupancy({
        events,
        startHour: gridStartHour,
        endHour: gridEndHour,
      }),
    [events, gridEndHour, gridStartHour],
  );

  if (!open) return null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-none flex-col border-l bg-background shadow-xl animate-in slide-in-from-right-4 duration-300 motion-reduce:animate-none sm:w-1/2 sm:min-w-[20rem] sm:max-w-[32rem]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Day schedule</p>
          <h2 className="text-sm font-semibold">{formatDayLabel(dateKey)}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={daySchedule.closed}
            onClick={() => onAddEvent(dateKey)}
          >
            <Plus className="size-4" />
            Add
          </Button>
          <IconButton onClick={onClose} aria-label="Close day schedule">
            <X className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {daySchedule.closed ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
            Closed — no business hours this day
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            {untimed.length > 0 ? (
              <div className="space-y-1 border-b bg-muted/20 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  All day
                </p>
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
                  />
                ))}
              </div>
            ) : null}

            <div className="flex">
              <div
                className="w-14 shrink-0 border-r bg-muted/20"
                style={{ height: totalHeight }}
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

              <div
                className="relative min-w-0 flex-1"
                style={{ height: totalHeight }}
              >
                {Array.from({ length: gridEndHour - gridStartHour }).map(
                  (_, hourIndex) => {
                    const hour = gridStartHour + hourIndex;
                    const withinDay =
                      hour >= daySchedule.startHour &&
                      hour < daySchedule.endHour;
                    const occupancyClass = getOccupancyBackgroundClass(
                      occupancy[hourIndex]?.ratio ?? 0,
                    );

                    return (
                      <button
                        key={hourIndex}
                        type="button"
                        disabled={!withinDay}
                        className={cn(
                          "absolute inset-x-0 border-b border-border/40 transition-colors",
                          withinDay
                            ? cn("hover:bg-primary/5", occupancyClass)
                            : "cursor-not-allowed bg-muted/30",
                        )}
                        style={{
                          top: hourIndex * HOUR_SLOT_HEIGHT_PX,
                          height: HOUR_SLOT_HEIGHT_PX,
                        }}
                        onClick={() => {
                          if (!withinDay) return;
                          onSelectSlot?.(
                            dateKey,
                            formatMinutesAsTime(hour * 60),
                          );
                        }}
                        aria-label={`Add event at ${hourLabels[hourIndex]}`}
                      />
                    );
                  },
                )}

                {timedBlockGroups.map((blockGroup) => (
                  <CalendarTimedEventStack
                    key={blockGroup.map((block) => block.event.id).join("-")}
                    blocks={blockGroup}
                    onSelectEvent={onSelectEvent}
                    onEditEvent={onEditEvent}
                    showAssigneeAvatars={showAssigneeAvatars}
                    membersById={membersById}
                    schedule={schedule}
                  />
                ))}

                {nowIndicator ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30"
                    style={{ top: nowIndicator.topPx }}
                  >
                    <div className="relative flex items-center">
                      <span className="absolute -left-1 size-2 rounded-full bg-red-500" />
                      <div className="h-px flex-1 border-t border-dashed border-red-500" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {events.length === 0 && !daySchedule.closed ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing scheduled for this day.
          </p>
        ) : null}
      </div>
    </aside>
  );
};
