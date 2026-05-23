import { Link } from "react-router";
import type { ComponentProps } from "react";
import { useGetList, type Identifier } from "ra-core";
import type { CalendarEventRecord } from "@/components/atomic-crm/types";
import {
  formatEventTimeRange,
  formatRemindBeforeLabel,
  getCalendarEntryKind,
} from "@/lbs/calendar/calendarReminderOptions";
import { MeetingLinkActions } from "@/lbs/meetings/MeetingLinkActions";

const formatEventDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const getCalendarEntryTypeLabel = (record: CalendarEventRecord) => {
  const kind = getCalendarEntryKind(record);
  if (kind === "meeting") return "Video call";
  if (kind === "activity") return "Activity";
  if (kind === "scheduled_task") return "Assigned task";
  return "Reminder";
};

export const buildCalendarEventsFilter = ({
  dealId,
  contactId,
  contactIds,
  showCompleted = false,
}: {
  dealId?: Identifier | null;
  contactId?: Identifier | null;
  contactIds?: Identifier[];
  showCompleted?: boolean;
}) => {
  const filter: Record<string, unknown> = showCompleted
    ? { "completed_at@not": null }
    : { "completed_at@is": null };

  if (dealId != null) {
    filter["deal_id@eq"] = dealId;
  }

  if (contactId != null) {
    filter["contact_id@eq"] = contactId;
  } else if (contactIds && contactIds.length > 0) {
    filter["contact_id@in"] = `(${contactIds.join(",")})`;
  }

  return filter;
};

export const getCalendarEventSortDate = (record: CalendarEventRecord) => {
  const time = record.event_time?.slice(0, 5) ?? "00:00";
  return `${record.event_date}T${time}`;
};

export const LinkedCalendarEventsList = ({
  dealId,
  contactId,
  contactIds,
  showCompleted = false,
  limit,
  emptyMessage = "No linked calendar events yet.",
  className,
  enabled = true,
}: {
  dealId?: Identifier | null;
  contactId?: Identifier | null;
  contactIds?: Identifier[];
  showCompleted?: boolean;
  limit?: number;
  emptyMessage?: string;
  className?: string;
  enabled?: boolean;
}) => {
  const hasScope =
    dealId != null ||
    contactId != null ||
    (contactIds != null && contactIds.length > 0);

  const { data: events = [], isPending } = useGetList<CalendarEventRecord>(
    "calendar_events",
    {
      filter: buildCalendarEventsFilter({
        dealId,
        contactId,
        contactIds,
        showCompleted,
      }),
      pagination: { page: 1, perPage: limit ?? 20 },
      sort: { field: "event_date", order: "ASC" },
    },
    { enabled: enabled && hasScope, staleTime: 30_000 },
  );

  if (!hasScope) {
    return (
      <p className={`text-sm text-muted-foreground ${className ?? ""}`}>
        Link a contact before showing calendar events.
      </p>
    );
  }

  if (isPending) return null;

  if (events.length === 0) {
    return (
      <p className={`text-sm text-muted-foreground ${className ?? ""}`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={`space-y-2 ${className ?? ""}`}>
      {events.map((event) => {
        const timeLabel = formatEventTimeRange(
          event.event_time,
          event.duration_minutes,
        );
        const remindLabel = formatRemindBeforeLabel(
          event.remind_before_minutes,
        );

        return (
          <li
            key={String(event.id)}
            className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{event.title}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{getCalendarEntryTypeLabel(event)}</span>
                {timeLabel ? <span>{timeLabel}</span> : null}
                {remindLabel ? <span>{remindLabel}</span> : null}
              </div>
              {event.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
              {event.meeting_url ? (
                <div className="mt-2">
                  <MeetingLinkActions meetingUrl={event.meeting_url} />
                </div>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatEventDate(event.event_date)}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const CalendarEventsSection = ({
  title,
  subtitle,
  viewAllHref = "/calendar",
  emptyMessage,
  showCompleted,
  ...listProps
}: {
  title: string;
  subtitle: string;
  viewAllHref?: string;
  emptyMessage: string;
  showCompleted?: boolean;
  dealId?: Identifier | null;
  contactId?: Identifier | null;
  contactIds?: Identifier[];
  enabled?: boolean;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Link to={viewAllHref} className="text-sm link-action">
        Open calendar
      </Link>
    </div>
    <LinkedCalendarEventsList
      {...listProps}
      showCompleted={showCompleted}
      emptyMessage={emptyMessage}
    />
  </div>
);

export const ProjectCalendarEventsList = ({
  dealId,
  ...props
}: Omit<
  ComponentProps<typeof LinkedCalendarEventsList>,
  "dealId" | "contactId" | "contactIds"
> & { dealId: Identifier }) => (
  <LinkedCalendarEventsList dealId={dealId} {...props} />
);

export const ProjectCalendarEventsSection = ({
  dealId,
  showCompleted = false,
  title = "Project events",
}: {
  dealId: Identifier;
  showCompleted?: boolean;
  title?: string;
}) => (
  <CalendarEventsSection
    title={title}
    subtitle="Calendar events linked to this project. These are not the same as tasks."
    dealId={dealId}
    showCompleted={showCompleted}
    emptyMessage={
      showCompleted
        ? "No completed events for this project yet."
        : "No upcoming events for this project yet. Link an event to this project from the calendar."
    }
  />
);

export const ContactCalendarEventsSection = ({
  contactId,
  contactIds,
  showCompleted = false,
  title = "Calendar events",
}: {
  contactId?: Identifier | null;
  contactIds?: Identifier[];
  showCompleted?: boolean;
  title?: string;
}) => (
  <CalendarEventsSection
    title={title}
    subtitle="Follow-ups and reminders linked to this contact. These are not the same as tasks."
    contactId={contactId}
    contactIds={contactIds}
    showCompleted={showCompleted}
    enabled={contactId != null || (contactIds != null && contactIds.length > 0)}
    emptyMessage={
      showCompleted
        ? "No completed calendar events for this contact yet."
        : "No upcoming calendar events for this contact yet. Link an event from the calendar."
    }
  />
);
