import { Link } from "react-router";
import { BellPlus, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarEventChip } from "@/lbs/calendar/CalendarEventChip";
import {
  formatDayLabel,
  getCalendarEntryMeta,
  getEventLabel,
  isCalendarEntryEvent,
  type CalendarEntryEvent,
  type CalendarEvent,
} from "@/lbs/calendar/calendarUtils";
import { formatEventTimeRange } from "@/lbs/calendar/calendarReminderOptions";
import { MeetingLinkActions } from "@/lbs/meetings/MeetingLinkActions";

const getEntryTypeLabel = (event: CalendarEntryEvent) => {
  if (event.kind === "meeting") return "Video call";
  if (event.kind === "activity") return "Activity";
  if (event.kind === "scheduled_task") return "Task";
  return "Reminder";
};

const CalendarEntryListItem = ({
  event,
  onEdit,
}: {
  event: CalendarEntryEvent;
  onEdit: (event: CalendarEntryEvent) => void;
}) => {
  const { timeLabel, remindLabel } = getCalendarEntryMeta(event);
  const timeRangeLabel = formatEventTimeRange(
    event.record.event_time,
    event.record.duration_minutes,
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full cursor-pointer text-left"
      onClick={() => onEdit(event)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          onEdit(event);
        }
      }}
    >
      <CalendarEventChip event={event} static />
      {event.record.description ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {event.record.description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{getEntryTypeLabel(event)}</span>
        {timeRangeLabel ? <span>Time: {timeRangeLabel}</span> : timeLabel ? <span>Time: {timeLabel}</span> : null}
        {remindLabel ? <span>Alert: {remindLabel}</span> : null}
        {event.assignedName ? <span>Assigned: {event.assignedName}</span> : null}
        {event.record.contact_id ? (
          <Link
            to={`/contacts/${event.record.contact_id}/show`}
            className="link-action"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            Contact: {event.contactName ?? "View contact"}
          </Link>
        ) : null}
        {event.record.deal_id ? (
          <Link
            to={`/deals/${event.record.deal_id}/show?tab=overview`}
            className="link-action"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            Project
          </Link>
        ) : null}
      </div>
      {event.record.meeting_url ? (
        <div className="mt-3">
          <MeetingLinkActions meetingUrl={event.record.meeting_url} />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Click to edit event</p>
    </div>
  );
};

export const CalendarDayDialog = ({
  dateKey,
  events,
  open,
  onOpenChange,
  onCreateTask,
  onCreateReminder,
  onScheduleMeeting,
  onEditTask,
  onEditReminder,
}: {
  dateKey: string | null;
  events: CalendarEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (dateKey: string) => void;
  onCreateReminder: (dateKey: string) => void;
  onScheduleMeeting?: (dateKey: string) => void;
  onEditTask: (event: Extract<CalendarEvent, { kind: "task" }>) => void;
  onEditReminder: (event: CalendarEntryEvent) => void;
}) => {
  if (!dateKey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDayLabel(dateKey)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => onCreateTask(dateKey)}
            >
              <Plus className="size-4" />
              Add task
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => onCreateReminder(dateKey)}
            >
              <BellPlus className="size-4" />
              Add event
            </Button>
            {onScheduleMeeting ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start sm:col-span-2"
                onClick={() => onScheduleMeeting(dateKey)}
              >
                <Video className="size-4" />
                Schedule video call
              </Button>
            ) : null}
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled for this day yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="rounded-md border p-3">
                  {event.kind === "task" ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full cursor-pointer text-left"
                      onClick={() => onEditTask(event)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          onEditTask(event);
                        }
                      }}
                    >
                      <CalendarEventChip event={event} static />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Click to edit task
                      </p>
                    </div>
                  ) : isCalendarEntryEvent(event) ? (
                    <CalendarEntryListItem event={event} onEdit={onEditReminder} />
                  ) : (
                    <div className="space-y-2">
                      <CalendarEventChip event={event} />
                      <Link
                        to={`/deals/${event.dealId}/show?tab=overview`}
                        className="text-xs link-action"
                        onClick={() => onOpenChange(false)}
                      >
                        Open project
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {getEventLabel(event)}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
