import type { OrganizationMember } from "@/components/atomic-crm/types";
import { CalendarMonthGrid } from "@/modules/calendar/CalendarMonthGrid";
import { CalendarTimeWeekGrid } from "@/modules/calendar/CalendarTimeWeekGrid";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
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
  schedule,
  selectedDateKey,
  onSelectDay,
  onSelectEvent,
  onEditEvent,
  onSelectSlot,
  showAssigneeAvatars = false,
  membersById,
}: {
  anchor: Date;
  view: CalendarView;
  eventsByDate: Record<string, CalendarEvent[]>;
  displayOptions: CalendarDisplayOptions;
  schedule: CalendarBusinessHoursSchedule;
  selectedDateKey?: string | null;
  onSelectDay: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSelectSlot?: (dateKey: string, time: string) => void;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
}) =>
  view === "month" ? (
    <CalendarMonthGrid
      anchor={anchor}
      eventsByDate={eventsByDate}
      displayOptions={displayOptions}
      schedule={schedule}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
      onEditEvent={onEditEvent}
      showAssigneeAvatars={showAssigneeAvatars}
      membersById={membersById}
    />
  ) : (
    <CalendarTimeWeekGrid
      anchor={startOfWeek(anchor)}
      eventsByDate={eventsByDate}
      displayOptions={displayOptions}
      schedule={schedule}
      selectedDateKey={selectedDateKey}
      onSelectDay={onSelectDay}
      onSelectEvent={onSelectEvent}
      onEditEvent={onEditEvent}
      onSelectSlot={onSelectSlot}
      showAssigneeAvatars={showAssigneeAvatars}
      membersById={membersById}
    />
  );
