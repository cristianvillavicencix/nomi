import { CalendarMonthGrid } from "@/modules/calendar/CalendarMonthGrid";
import { CalendarTimeWeekGrid } from "@/modules/calendar/CalendarTimeWeekGrid";
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
  selectedDateKey,
  onSelectDay,
  onSelectEvent,
  onSelectSlot,
}: {
  anchor: Date;
  view: CalendarView;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  selectedDateKey?: string | null;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (dateKey: string, time: string) => void;
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
    <CalendarTimeWeekGrid
      anchor={startOfWeek(anchor)}
      eventsByDate={eventsByDate}
      displayOptions={displayOptions}
      selectedDateKey={selectedDateKey}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
      onSelectSlot={onSelectSlot}
    />
  );
