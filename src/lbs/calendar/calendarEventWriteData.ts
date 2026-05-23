import {
  DURATION_NONE,
  REMIND_BEFORE_NONE,
} from "@/lbs/calendar/calendarReminderOptions";

const NULLABLE_ID_FIELDS = [
  "person_id",
  "contact_id",
  "deal_id",
  "company_id",
  "organization_member_id",
] as const;

const toNullableId = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const prepareCalendarEventWriteData = (
  data: Record<string, unknown>,
) => {
  const next: Record<string, unknown> = { ...data };

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

  next.updated_at = new Date().toISOString();

  delete next.created_at;
  delete next.org_id;
  delete next._meeting_contact_name;
  delete next._meeting_link_seed;

  return next;
};
