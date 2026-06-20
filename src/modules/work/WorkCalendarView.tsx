import { CalendarMonthGrid } from "@/modules/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/modules/calendar/CalendarWeekGrid";
import {
  startOfWeek,
  type CalendarDisplayOptions,
  type CalendarEvent,
  type CalendarView,
} from "@/modules/calendar/calendarUtils";

export const WorkCalendarView = ({
  anchor,
  view,
  eventsByDate,
  displayOptions,
  onSelectDay,
  onSelectEvent,
}: {
  anchor: Date;
  view: CalendarView;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) =>
  view === "month" ? (
    <CalendarMonthGrid
      anchor={anchor}
      eventsByDate={eventsByDate}
      displayOptions={displayOptions}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
    />
  ) : (
    <CalendarWeekGrid
      anchor={startOfWeek(anchor)}
      eventsByDate={eventsByDate}
      displayOptions={displayOptions}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
    />
  );
