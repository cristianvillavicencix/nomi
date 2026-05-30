import { formatDistanceToNow } from "date-fns";
import {
  CalendarClock,
  FileText,
  GitBranch,
  ListChecks,
  UserRoundPlus,
} from "lucide-react";
import { useMemo } from "react";
import {
  ResourceContextProvider,
  useGetList,
  type Identifier,
} from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeDate } from "@/components/atomic-crm/misc/RelativeDate";
import { NoteCreate } from "@/components/atomic-crm/notes";
import { Note } from "@/components/atomic-crm/notes/Note";
import type {
  CalendarEventRecord,
  Contact,
  ContactNote,
  Task,
} from "@/components/atomic-crm/types";
import {
  formatEventTimeLabel,
  formatRemindBeforeLabel,
  getCalendarEntryKind,
} from "@/lbs/calendar/calendarReminderOptions";
import { getCalendarEventSortDate } from "@/lbs/calendar/ProjectCalendarEventsList";
import { isPipelineTransitionNote } from "@/lbs/leads/leadFollowUpUtils";

export type ContactActivityFeedItem =
  | { id: string; type: "note"; date: string; note: ContactNote }
  | { id: string; type: "task"; date: string; task: Task }
  | {
      id: string;
      type: "calendar_event";
      date: string;
      calendarEvent: CalendarEventRecord;
    }
  | { id: string; type: "created"; date: string };

export const PipelineUpdateBadge = () => (
  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
    Pipeline update
  </Badge>
);

const FeedLoading = () => (
  <div className="space-y-3">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

const FeedEmpty = ({ label }: { label: string }) => (
  <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
    {label}
  </p>
);

const ActivityFeedRow = ({ event }: { event: ContactActivityFeedItem }) => {
  if (event.type === "note") {
    const isPipelineNote = isPipelineTransitionNote(event.note);

    return (
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {isPipelineNote ? (
            <GitBranch className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
          {isPipelineNote ? "Pipeline change" : "Note"}
          {isPipelineNote ? <PipelineUpdateBadge /> : null}
          <span className="normal-case tracking-normal">
            <RelativeDate date={event.date} />
          </span>
        </div>
        <ResourceContextProvider value="contact_notes">
          <Note note={event.note} showStatus />
        </ResourceContextProvider>
      </div>
    );
  }

  if (event.type === "task") {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <ListChecks className="size-4" />
              {event.task.done_date ? "Task completed" : "Task scheduled"}
            </div>
            <p className="text-sm font-medium">{event.task.text}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.task.type !== "None" && event.task.type !== "none"
                ? `${event.task.type} · `
                : ""}
              {event.task.done_date ? "Completed" : "Due"}{" "}
              {formatDistanceToNow(new Date(event.date), {
                addSuffix: true,
              })}
            </p>
          </div>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            <RelativeDate date={event.date} />
          </span>
        </div>
      </div>
    );
  }

  if (event.type === "calendar_event") {
    const timeLabel = formatEventTimeLabel(event.calendarEvent.event_time);
    const remindLabel = formatRemindBeforeLabel(
      event.calendarEvent.remind_before_minutes,
    );
    const entryKind = getCalendarEntryKind(event.calendarEvent);
    const entryLabel =
      entryKind === "activity"
        ? "Activity"
        : entryKind === "scheduled_task"
          ? "Assigned task"
          : "Calendar event";

    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <CalendarClock className="size-4" />
              {event.calendarEvent.completed_at
                ? `${entryLabel} done`
                : entryLabel}
            </div>
            <p className="text-sm font-medium">{event.calendarEvent.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                new Date(event.calendarEvent.event_date).toLocaleDateString(
                  undefined,
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  },
                ),
                timeLabel,
                remindLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {event.calendarEvent.description ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {event.calendarEvent.description}
              </p>
            ) : null}
          </div>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            <RelativeDate date={event.date} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <UserRoundPlus className="size-4" />
            Contact created
          </div>
          <p className="text-sm text-muted-foreground">
            This contact was added{" "}
            {formatDistanceToNow(new Date(event.date), { addSuffix: true })}.
          </p>
        </div>
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          <RelativeDate date={event.date} />
        </span>
      </div>
    </div>
  );
};

export const ContactActivityFeed = ({
  contact,
  contactId,
  showNoteCreate = true,
  emptyLabel = "No activity yet for this contact.",
}: {
  contact?: Contact;
  contactId?: Identifier;
  showNoteCreate?: boolean;
  emptyLabel?: string;
}) => {
  const resolvedContactId = contactId ?? contact?.id;
  const createdAt = contact?.first_seen;

  const { data: notes, isPending: notesPending } = useGetList<ContactNote>(
    "contact_notes",
    {
      filter: { "contact_id@eq": resolvedContactId! },
      sort: { field: "date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: resolvedContactId != null },
  );

  const { data: tasks, isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      filter: { "contact_id@eq": resolvedContactId! },
      sort: { field: "due_date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
    { enabled: resolvedContactId != null },
  );

  const { data: calendarEvents = [], isPending: calendarEventsPending } =
    useGetList<CalendarEventRecord>(
      "calendar_events",
      {
        filter: { "contact_id@eq": resolvedContactId! },
        sort: { field: "event_date", order: "DESC" },
        pagination: { page: 1, perPage: 50 },
      },
      { staleTime: 30_000, enabled: resolvedContactId != null },
    );

  const events = useMemo<ContactActivityFeedItem[]>(() => {
    const noteEvents =
      notes?.map((note) => ({
        id: `note-${note.id}`,
        type: "note" as const,
        date: note.date,
        note,
      })) ?? [];
    const taskEvents =
      tasks?.map((task) => ({
        id: `task-${task.id}`,
        type: "task" as const,
        date: task.done_date ?? task.due_date,
        task,
      })) ?? [];
    const calendarEventItems =
      calendarEvents.map((calendarEvent) => ({
        id: `calendar-${calendarEvent.id}`,
        type: "calendar_event" as const,
        date: getCalendarEventSortDate(calendarEvent),
        calendarEvent,
      })) ?? [];
    const createdEvent: ContactActivityFeedItem[] = createdAt
      ? [
          {
            id: `created-${resolvedContactId}`,
            type: "created",
            date: createdAt,
          },
        ]
      : [];

    return [
      ...noteEvents,
      ...taskEvents,
      ...calendarEventItems,
      ...createdEvent,
    ].sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
  }, [calendarEvents, createdAt, notes, resolvedContactId, tasks]);

  if (resolvedContactId == null) {
    return (
      <FeedEmpty label="Select a contact to view activity." />
    );
  }

  if (notesPending || tasksPending || calendarEventsPending) {
    return <FeedLoading />;
  }

  return (
    <div className="space-y-4">
      {showNoteCreate ? (
        <NoteCreate
          reference="contacts"
          showStatus
          contactId={resolvedContactId}
        />
      ) : null}
      {events.length === 0 ? (
        <FeedEmpty label={emptyLabel} />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <ActivityFeedRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};
