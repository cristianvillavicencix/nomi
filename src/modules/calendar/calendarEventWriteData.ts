import {
  DURATION_NONE,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";

const NULLABLE_ID_FIELDS = [
  "contact_id",
  "deal_id",
  "company_id",
  "organization_member_id",
] as const;

/** Dropped from calendar_events in B3 — never send to PostgREST. */
const STRIPPED_LEGACY_FIELDS = ["person_id"] as const;

const toNullableId = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export type PrepareCalendarEventOptions = {
  /** Workspace/host IANA timezone when the event does not already set one. */
  defaultTimezone?: string | null;
};

export const prepareCalendarEventWriteData = (
  data: Record<string, unknown>,
  options?: PrepareCalendarEventOptions,
) => {
  const next: Record<string, unknown> = { ...data };

  STRIPPED_LEGACY_FIELDS.forEach((field) => {
    delete next[field];
  });

  NULLABLE_ID_FIELDS.forEach((field) => {
    if (field in next) {
      next[field] = toNullableId(next[field]);
    }
  });

  if (
    next.remind_before_minutes === REMIND_BEFORE_NONE ||
    next.remind_before_minutes === ""
  ) {
    next.remind_before_minutes = null;
  } else if (next.remind_before_minutes != null) {
    const minutes = Number(next.remind_before_minutes);
    next.remind_before_minutes = Number.isFinite(minutes) ? minutes : null;
  }

  if (next.event_time === "") {
    next.event_time = null;
  }

  if (next.duration_minutes === DURATION_NONE || next.duration_minutes === "") {
    next.duration_minutes = null;
  } else if (next.duration_minutes != null) {
    const minutes = Number(next.duration_minutes);
    next.duration_minutes =
      Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  if (next.description === "") {
    next.description = null;
  }

  if (next.meeting_url === "") {
    next.meeting_url = null;
  }

  const existingTz = String(next.timezone ?? "").trim();
  if (!existingTz) {
    next.timezone =
      String(options?.defaultTimezone ?? "").trim() || DEFAULT_ORG_TIMEZONE;
  } else {
    next.timezone = existingTz;
  }

  next.updated_at = new Date().toISOString();

  delete next.created_at;
  delete next.org_id;
  delete next._meeting_contact_name;
  delete next._meeting_link_seed;

  return next;
};
