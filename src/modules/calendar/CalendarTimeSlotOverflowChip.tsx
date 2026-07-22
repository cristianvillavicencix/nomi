import { useState } from "react";
import { Layers } from "lucide-react";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarInteractiveEventChip } from "@/modules/calendar/CalendarInteractiveEventChip";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
import { isEventOutsideBusinessHours } from "@/modules/calendar/calendarBusinessHours";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";
import {
  formatEventTimeLabel,
  formatEventTimeRange,
} from "@/modules/calendar/calendarReminderOptions";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

const getOverflowTimeLabel = (events: CalendarEvent[]) => {
  const firstTimed = events.find(
    (event): event is CalendarEvent & { time: string } =>
      "time" in event && Boolean(event.time?.trim()),
  );

  if (!firstTimed) return "All day";

  if ("record" in firstTimed) {
    return (
      formatEventTimeRange(
        firstTimed.record.event_time,
        firstTimed.record.duration_minutes,
      ) || formatEventTimeLabel(firstTimed.time)
    );
  }

  return formatEventTimeLabel(firstTimed.time);
};

export const CalendarTimeSlotOverflowChip = ({
  events,
  compact = false,
  onSelectEvent,
  onEditEvent,
  showAssigneeAvatars = false,
  membersById,
  schedule,
  className,
}: {
  events: CalendarEvent[];
  compact?: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
  schedule?: CalendarBusinessHoursSchedule;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const timeLabel = getOverflowTimeLabel(events);
  const chipLabel = `${events.length} items · ${timeLabel}`;
  const panelTitle = `${events.length} items at ${timeLabel}`;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          calendarEventPreviewController.closeImmediately();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-1 rounded border border-dashed border-muted-foreground/35 bg-muted/40 px-1.5 text-left text-[11px] font-medium leading-5 text-foreground transition-colors hover:bg-muted/70",
            compact ? "py-0" : "py-0.5",
            className,
          )}
          aria-label={`Show ${events.length} items at ${timeLabel}`}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
          }}
        >
          <Layers className="size-3 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{chipLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        className="z-[100] w-80 p-0"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="border-b px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">Same time</p>
          <p className="text-sm font-semibold">{panelTitle}</p>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto p-2">
          {events.map((event) => (
            <CalendarInteractiveEventChip
              key={event.id}
              event={event}
              compact={false}
              enablePreview={false}
              onClick={(selectedEvent) => {
                setOpen(false);
                onSelectEvent(selectedEvent);
              }}
              onEdit={onEditEvent}
              showAssigneeAvatars={showAssigneeAvatars}
              membersById={membersById}
              outsideBusinessHours={
                schedule
                  ? isEventOutsideBusinessHours(
                      {
                        date: event.date,
                        time: "time" in event ? event.time : null,
                      },
                      schedule,
                    )
                  : false
              }
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
