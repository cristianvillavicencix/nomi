import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  buildIcsCalendar,
  type IcalEventInput,
} from "./icalFeed.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";

const FEED_PAST_DAYS = 30;
const FEED_FUTURE_DAYS = 365;
const DEFAULT_TIMEZONE = "America/New_York";

type FeedMember = {
  id: number;
  org_id: number;
  first_name: string | null;
  last_name: string | null;
};

type TaskRow = {
  id: number;
  text: string | null;
  type: string | null;
  due_date: string;
};

type CalendarEventRow = {
  id: number;
  title: string;
  event_date: string;
  event_time: string | null;
  duration_minutes: number | null;
  remind_before_minutes: number | null;
  description: string | null;
  meeting_url: string | null;
};

type BookingRow = {
  id: number;
  service_name: string;
  guest_name: string;
  guest_company: string | null;
  event_date: string;
  event_time: string;
};

const isoDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const feedDateRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - FEED_PAST_DAYS);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + FEED_FUTURE_DAYS);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: isoDateOnly(start),
    endDate: isoDateOnly(end),
  };
};

const memberDisplayName = (member: FeedMember) => {
  const parts = [member.first_name, member.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "My calendar";
};

const resolveOrgTimezone = async (
  client: SupabaseClient,
  orgId: number,
): Promise<string> => {
  const { data } = await client
    .from("organizations")
    .select("booking_settings")
    .eq("id", orgId)
    .maybeSingle();

  const settings = data?.booking_settings as
    | { timezone_label?: string | null }
    | null
    | undefined;
  const label = settings?.timezone_label?.trim();
  return label || DEFAULT_TIMEZONE;
};

const fetchMemberTasks = async (
  client: SupabaseClient,
  orgId: number,
  memberId: number,
  startIso: string,
  endIso: string,
): Promise<TaskRow[]> => {
  const { data: participantRows } = await client
    .from("task_participants")
    .select("task_id")
    .eq("organization_member_id", memberId);

  const participantTaskIds = (participantRows ?? [])
    .map((row) => row.task_id)
    .filter((id): id is number => typeof id === "number");

  const filters = [
    `organization_member_id.eq.${memberId}`,
    `assignee_person_ids.cs.{${memberId}}`,
  ];
  if (participantTaskIds.length > 0) {
    filters.push(`id.in.(${participantTaskIds.join(",")})`);
  }

  const { data, error } = await client
    .from("tasks")
    .select("id, text, type, due_date")
    .eq("org_id", orgId)
    .is("done_date", null)
    .gte("due_date", startIso)
    .lte("due_date", endIso)
    .or(filters.join(","));

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }

  return (data ?? []) as TaskRow[];
};

const fetchMemberCalendarEvents = async (
  client: SupabaseClient,
  orgId: number,
  memberId: number,
  startDate: string,
  endDate: string,
): Promise<CalendarEventRow[]> => {
  const { data, error } = await client
    .from("calendar_events")
    .select(
      "id, title, event_date, event_time, duration_minutes, remind_before_minutes, description, meeting_url",
    )
    .eq("org_id", orgId)
    .eq("organization_member_id", memberId)
    .is("completed_at", null)
    .gte("event_date", startDate)
    .lte("event_date", endDate);

  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  return (data ?? []) as CalendarEventRow[];
};

const fetchMemberBookings = async (
  client: SupabaseClient,
  orgId: number,
  memberId: number,
  startDate: string,
  endDate: string,
): Promise<BookingRow[]> => {
  const { data, error } = await client
    .from("public_bookings")
    .select(
      "id, service_name, guest_name, guest_company, event_date, event_time",
    )
    .eq("org_id", orgId)
    .eq("organization_member_id", memberId)
    .eq("status", "confirmed")
    .gte("event_date", startDate)
    .lte("event_date", endDate);

  if (error) {
    throw new Error(`Failed to load bookings: ${error.message}`);
  }

  return (data ?? []) as BookingRow[];
};

const taskToIcal = (task: TaskRow, appBaseUrl: string): IcalEventInput => {
  const dueDate = task.due_date.slice(0, 10);
  const label = task.text?.trim() || "Task";
  const typeSuffix = task.type ? ` (${task.type})` : "";

  return {
    uid: `nomi-task-${task.id}@nomicrm.com`,
    summary: `${label}${typeSuffix}`,
    description: `Nomi task #${task.id}`,
    url: `${appBaseUrl}/tasks`,
    allDay: true,
    startDate: dueDate,
  };
};

const calendarEventToIcal = (
  event: CalendarEventRow,
  tzid: string,
  appBaseUrl: string,
): IcalEventInput => {
  const descriptionParts = [event.description?.trim(), event.meeting_url?.trim()]
    .filter(Boolean)
    .join("\n\n");

  return {
    uid: `nomi-event-${event.id}@nomicrm.com`,
    summary: event.title,
    description: descriptionParts || `Nomi calendar event #${event.id}`,
    location: event.meeting_url ?? undefined,
    url: event.meeting_url ?? `${appBaseUrl}/tasks?view=calendar`,
    startDate: event.event_date,
    startTime: event.event_time,
    tzid,
    durationMinutes: event.duration_minutes,
    alarmMinutesBefore: event.remind_before_minutes,
  };
};

const bookingToIcal = (booking: BookingRow, tzid: string): IcalEventInput => {
  const guest = booking.guest_company
    ? `${booking.guest_name} (${booking.guest_company})`
    : booking.guest_name;

  return {
    uid: `nomi-booking-${booking.id}@nomicrm.com`,
    summary: `${booking.service_name} — ${guest}`,
    description: `Public booking with ${guest}`,
    startDate: booking.event_date,
    startTime: booking.event_time,
    tzid,
    durationMinutes: 30,
    alarmMinutesBefore: 60,
  };
};

export const buildMemberCalendarFeedIcs = async (
  client: SupabaseClient,
  member: FeedMember,
): Promise<string> => {
  const { startIso, endIso, startDate, endDate } = feedDateRange();
  const tzid = await resolveOrgTimezone(client, member.org_id);
  const appBaseUrl = resolvePublicAppBaseUrl();

  const [tasks, events, bookings] = await Promise.all([
    fetchMemberTasks(client, member.org_id, member.id, startIso, endIso),
    fetchMemberCalendarEvents(
      client,
      member.org_id,
      member.id,
      startDate,
      endDate,
    ),
    fetchMemberBookings(client, member.org_id, member.id, startDate, endDate),
  ]);

  const icalEvents: IcalEventInput[] = [
    ...tasks.map((task) => taskToIcal(task, appBaseUrl)),
    ...events.map((event) => calendarEventToIcal(event, tzid, appBaseUrl)),
    ...bookings.map((booking) => bookingToIcal(booking, tzid)),
  ];

  return buildIcsCalendar(icalEvents, `Nomi — ${memberDisplayName(member)}`);
};
