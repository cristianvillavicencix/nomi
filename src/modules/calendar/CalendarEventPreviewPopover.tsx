import { useState } from "react";
import {
  Activity,
  Bell,
  Calendar,
  CheckSquare,
  Package,
  Pencil,
  Phone,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getCalendarEntryMeta,
  getEventLabel,
  isCalendarEntryEvent,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { formatEventTimeRange } from "@/modules/calendar/calendarReminderOptions";
import { cn } from "@/lib/utils";

const getEventTypeMeta = (event: CalendarEvent) => {
  if (event.kind === "task") {
    return { label: "Task", icon: CheckSquare };
  }
  if (event.kind === "meeting") {
    return { label: "Meeting", icon: Video };
  }
  if (event.kind === "activity") {
    return { label: "Activity", icon: Activity };
  }
  if (event.kind === "project_delivery") {
    return { label: "Delivery", icon: Package };
  }
  if (event.kind === "project_start") {
    return { label: "Project start", icon: Calendar };
  }
  if (event.kind === "scheduled_task") {
    return { label: "Scheduled task", icon: CheckSquare };
  }
  if (event.kind === "reminder") {
    return { label: "Follow up", icon: Phone };
  }
  return { label: "Event", icon: Bell };
};

export const CalendarEventPreviewPopover = ({
  event,
  children,
  onEdit,
  outsideBusinessHours = false,
}: {
  event: CalendarEvent;
  children: React.ReactNode;
  onEdit: (event: CalendarEvent) => void;
  outsideBusinessHours?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const { label: typeLabel, icon: TypeIcon } = getEventTypeMeta(event);
  const title = getEventLabel(event);

  const timeLabel = isCalendarEntryEvent(event)
    ? formatEventTimeRange(
        event.record.event_time,
        event.record.duration_minutes,
      ) || getCalendarEntryMeta(event).timeLabel
    : "time" in event && event.time
      ? formatEventTimeRange(event.time, null)
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="min-w-0"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        avoidCollisions
        className="z-50 w-72 p-0"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-3 p-3">
          <div className="flex items-start gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <TypeIcon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {typeLabel}
              </p>
              <p className="text-sm font-semibold leading-snug">{title}</p>
              {timeLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">{timeLabel}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Edit event"
              onClick={() => {
                setOpen(false);
                onEdit(event);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>

          {isCalendarEntryEvent(event) && event.record.description ? (
            <p className="line-clamp-3 text-xs text-muted-foreground">
              {event.record.description}
            </p>
          ) : null}

          {event.kind === "meeting" ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              Video call
            </p>
          ) : null}

          {outsideBusinessHours ? (
            <p
              className={cn(
                "rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950",
                "dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
              )}
            >
              Outside business hours
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};
