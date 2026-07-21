import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarEventChip } from "@/modules/calendar/CalendarEventChip";
import {
  formatDayLabel,
  getCalendarEntryMeta,
  isCalendarEntryEvent,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { formatEventTimeRange } from "@/modules/calendar/calendarReminderOptions";

export const CalendarUpcomingPanel = ({
  selectedDateKey,
  events,
  onSelectEvent,
  onAddEvent,
}: {
  selectedDateKey: string;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onAddEvent: (dateKey: string) => void;
}) => (
  <aside className="flex min-h-0 flex-col gap-3 rounded-lg border bg-card p-4">
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">Upcoming</h2>
        <p className="text-xs text-muted-foreground">
          {formatDayLabel(selectedDateKey)}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onAddEvent(selectedDateKey)}
      >
        <Plus className="size-4" />
        Add
      </Button>
    </div>

    {events.length === 0 ? (
      <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
    ) : (
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {events.map((event) => {
          const timeLabel = isCalendarEntryEvent(event)
            ? formatEventTimeRange(
                event.record.event_time,
                event.record.duration_minutes,
              ) || getCalendarEntryMeta(event).timeLabel
            : null;

          return (
            <li key={event.id}>
              <button
                type="button"
                className="w-full rounded-md border p-2 text-left transition-colors hover:bg-muted/30"
                onClick={() => onSelectEvent(event)}
              >
                <CalendarEventChip event={event} static />
                {timeLabel ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeLabel}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </aside>
);
