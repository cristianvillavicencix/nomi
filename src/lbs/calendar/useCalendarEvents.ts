import { useMemo } from "react";
import { useGetList, useGetMany, type Identifier } from "ra-core";
import type {
  CalendarEventRecord,
  Contact,
  Deal,
  Person,
  Task,
} from "@/components/atomic-crm/types";
import { getPersonName } from "@/components/atomic-crm/tasks/taskPeopleOptions";
import {
  buildCalendarEntryEvent,
  buildDealCalendarEvents,
  buildTaskCalendarEvent,
  getVisibleRange,
  groupEventsByDate,
  type CalendarEvent,
  type CalendarView,
} from "@/lbs/calendar/calendarUtils";

const getContactName = (contact?: Contact | null) =>
  contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
      "Contact"
    : null;

export const useCalendarEvents = ({
  anchor,
  view,
  includeDoneTasks = false,
  includeCompletedReminders = false,
  projectId = null,
}: {
  anchor: Date;
  view: CalendarView;
  includeDoneTasks?: boolean;
  includeCompletedReminders?: boolean;
  projectId?: Identifier | null;
}) => {
  const range = useMemo(() => getVisibleRange(anchor, view), [anchor, view]);
  const projectFilter =
    projectId != null && projectId !== "" ? { "deal_id@eq": projectId } : {};

  const { data: tasks = [], isPending: isTasksPending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        "due_date@gte": range.start,
        "due_date@lte": range.end,
        ...(includeDoneTasks ? {} : { "done_date@is": null }),
        ...projectFilter,
      },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { data: reminders = [], isPending: isRemindersPending } =
    useGetList<CalendarEventRecord>(
      "calendar_events",
      {
        filter: {
          "event_date@gte": range.start,
          "event_date@lte": range.end,
          ...(includeCompletedReminders ? {} : { "completed_at@is": null }),
          ...projectFilter,
        },
        pagination: { page: 1, perPage: 500 },
        sort: { field: "event_date", order: "ASC" },
      },
      { staleTime: 30_000 },
    );

  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          reminders
            .map((entry) => entry.person_id)
            .filter((id) => id != null)
            .map(String),
        ),
      ),
    [reminders],
  );

  const contactIds = useMemo(
    () =>
      Array.from(
        new Set(
          reminders
            .map((entry) => entry.contact_id)
            .filter((id) => id != null)
            .map(String),
        ),
      ),
    [reminders],
  );

  const { data: people = [] } = useGetMany<Person>(
    "people",
    { ids: personIds },
    { enabled: personIds.length > 0, staleTime: 60_000 },
  );

  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0, staleTime: 60_000 },
  );

  const peopleById = useMemo(() => {
    const map = new Map<string, Person>();
    people.forEach((person) => map.set(String(person.id), person));
    return map;
  }, [people]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((contact) => map.set(String(contact.id), contact));
    return map;
  }, [contacts]);

  const { data: deals = [], isPending: isDealsPending } = useGetList<Deal>(
    "deals",
    {
      filter:
        projectId != null && projectId !== "" ? { "id@eq": projectId } : {},
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const events = useMemo(() => {
    const taskEvents = tasks
      .map(buildTaskCalendarEvent)
      .filter((event): event is CalendarEvent => event != null);

    const reminderEvents = reminders
      .map((entry) =>
        buildCalendarEntryEvent(entry, {
          assignedName: entry.person_id
            ? peopleById.get(String(entry.person_id))
              ? getPersonName(peopleById.get(String(entry.person_id))!)
              : null
            : null,
          contactName: entry.contact_id
            ? getContactName(contactsById.get(String(entry.contact_id)))
            : null,
        }),
      )
      .filter((event): event is CalendarEvent => event != null);

    const dealEvents = deals
      .flatMap(buildDealCalendarEvents)
      .filter((event) => event.date >= range.start && event.date <= range.end);

    return [...taskEvents, ...reminderEvents, ...dealEvents];
  }, [
    contactsById,
    deals,
    peopleById,
    range.end,
    range.start,
    reminders,
    tasks,
  ]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  return {
    events,
    eventsByDate,
    range,
    isPending: isTasksPending || isRemindersPending || isDealsPending,
  };
};
