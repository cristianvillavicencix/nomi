import { CalendarDays, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarWeekGrid } from "@/modules/calendar/CalendarWeekGrid";
import {
  startOfWeek,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { useCalendarEvents } from "@/modules/calendar/useCalendarEvents";

export const DashboardWeekCalendar = () => {
  const navigate = useNavigate();
  const [anchor] = useState(() => new Date());

  const weekAnchor = useMemo(() => startOfWeek(anchor), [anchor]);

  const { eventsByDate, isPending } = useCalendarEvents({
    anchor: weekAnchor,
    view: "week",
    includeDoneTasks: false,
    includeCompletedReminders: false,
  });

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const displayOptions = useMemo(
    () => ({ showSaturday: true, showSunday: true }),
    [],
  );

  const handleSelectDay = (dateKey: string) => {
    navigate(`/tasks?view=calendar&date=${dateKey}`);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.kind === "task" && event.task.deal_id) {
      navigate(`/deals/${event.task.deal_id}/show?tab=tasks`);
      return;
    }
    navigate("/tasks?view=calendar");
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          <span className="font-medium text-foreground">{todayLabel}</span>
        </div>
        <Link
          to="/tasks?view=calendar"
          className="inline-flex items-center gap-1 text-sm link-action"
        >
          View calendar
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {isPending ? (
        <div className="h-[420px] animate-pulse rounded-lg border bg-muted/30" />
      ) : (
        <CalendarWeekGrid
          anchor={weekAnchor}
          eventsByDate={eventsByDate}
          displayOptions={displayOptions}
          onSelectDay={handleSelectDay}
          onSelectEvent={handleSelectEvent}
        />
      )}
    </section>
  );
};
