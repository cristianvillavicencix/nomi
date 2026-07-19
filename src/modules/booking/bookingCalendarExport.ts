export type BookingCalendarEventInput = {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  description?: string;
  location?: string;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalDate = (date: string, time: string) => {
  const normalized = time.trim().slice(0, 5);
  return new Date(`${date}T${normalized}:00`);
};

const formatGoogleCalendarStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export const buildGoogleCalendarUrl = (input: BookingCalendarEventInput) => {
  const start = toLocalDate(input.date, input.time);
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

const formatIcsStamp = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
};

export const buildBookingIcs = (input: BookingCalendarEventInput) => {
  const start = toLocalDate(input.date, input.time);
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
    `DTSTAMP:${formatIcsStamp(new Date())}`,
    `DTSTART:${formatIcsStamp(start)}`,
    `DTEND:${formatIcsStamp(end)}`,
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
  downloadBookingIcs(input);
};
