import {
  DEFAULT_ORG_TIMEZONE,
  zonedWallTimeToUtcMs,
} from "@/lib/timezone/usTimezone";

export type BookingCalendarEventInput = {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  description?: string;
  location?: string;
  /** IANA timezone for wall-clock date/time (e.g. America/New_York). */
  timezone?: string | null;
};

const toUtcDate = (input: BookingCalendarEventInput) => {
  const tz = input.timezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const ms = zonedWallTimeToUtcMs(input.date, input.time, tz);
  if (ms == null) {
    return new Date(`${input.date}T${input.time.trim().slice(0, 5)}:00`);
  }
  return new Date(ms);
};

const formatGoogleCalendarStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export const buildGoogleCalendarUrl = (input: BookingCalendarEventInput) => {
  const start = toUtcDate(input);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${formatGoogleCalendarStamp(start)}/${formatGoogleCalendarStamp(end)}`,
    details: input.description ?? "",
  });
  if (input.location?.trim()) {
    params.set("location", input.location.trim());
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const escapeIcs = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const formatIcsUtcStamp = (date: Date) => {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return iso.endsWith("Z") ? iso : `${iso}Z`;
};

export const buildBookingIcs = (input: BookingCalendarEventInput) => {
  const start = toUtcDate(input);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const uid = `booking-${input.date}-${input.time.replace(":", "")}@nomicrm.com`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sigma by Latino Business Support//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtcStamp(new Date())}`,
    `DTSTART:${formatIcsUtcStamp(start)}`,
    `DTEND:${formatIcsUtcStamp(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    input.description ? `DESCRIPTION:${escapeIcs(input.description)}` : null,
    input.location ? `LOCATION:${escapeIcs(input.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
};

export const downloadBookingIcs = (
  input: BookingCalendarEventInput,
  filename = "booking.ics",
) => {
  const ics = buildBookingIcs(input);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const openAndroidCalendar = (input: BookingCalendarEventInput) => {
  window.location.assign(buildGoogleCalendarUrl(input));
};

export const openAppleCalendar = (input: BookingCalendarEventInput) => {
  downloadBookingIcs(input, "meeting.ics");
};
