const CRLF = "\r\n";

export const escapeIcalText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

export const foldIcalLine = (line: string): string => {
  if (line.length <= 75) {
    return line;
  }

  const parts: string[] = [line.slice(0, 75)];
  let index = 75;
  while (index < line.length) {
    parts.push(` ${line.slice(index, index + 74)}`);
    index += 74;
  }

  return parts.join(CRLF);
};

const toYmdCompact = (isoDate: string) => isoDate.slice(0, 10).replace(/-/g, "");

const toHmsCompact = (time: string) => {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return `${hours.padStart(2, "0")}${minutes.padStart(2, "0")}${seconds
    .padStart(2, "0")
    .slice(0, 2)}`;
};

const addDaysToIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

const addWallClockMinutes = (
  isoDate: string,
  time: string,
  minutesToAdd: number,
) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const [hours = 0, minutes = 0] = time.split(":").map((value) => Number(value) || 0);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const minutesInDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const endHours = Math.floor(minutesInDay / 60);
  const endMinutes = minutesInDay % 60;
  const endDate = addDaysToIsoDate(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    dayOffset,
  );

  return {
    endDate: toYmdCompact(endDate),
    endTime: `${String(endHours).padStart(2, "0")}${String(endMinutes).padStart(2, "0")}00`,
  };
};

const formatDtStamp = (date = new Date()) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
};

export type IcalEventInput = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  allDay?: boolean;
  startDate: string;
  startTime?: string | null;
  tzid?: string;
  durationMinutes?: number | null;
  alarmMinutesBefore?: number | null;
  alarmMinutesBeforeList?: number[] | null;
};

const buildValarmLines = (minutesBefore: number) => [
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:Reminder",
  `TRIGGER:-PT${Math.max(1, Math.round(minutesBefore))}M`,
  "END:VALARM",
];

const buildVeventLines = (event: IcalEventInput): string[] => {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDtStamp()}`,
    `SUMMARY:${escapeIcalText(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcalText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  if (event.allDay || !event.startTime) {
    const start = toYmdCompact(event.startDate);
    const end = toYmdCompact(addDaysToIsoDate(event.startDate.slice(0, 10), 1));
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
  } else {
    const tzid = event.tzid || "UTC";
    const start = toYmdCompact(event.startDate);
    const startTime = toHmsCompact(event.startTime);
    const duration = event.durationMinutes ?? 30;
    const { endDate, endTime } = addWallClockMinutes(
      event.startDate.slice(0, 10),
      event.startTime,
      duration,
    );
    lines.push(`DTSTART;TZID=${tzid}:${start}T${startTime}`);
    lines.push(`DTEND;TZID=${tzid}:${endDate}T${endTime}`);
  }

  const alarmOffsets =
    event.alarmMinutesBeforeList?.filter(
      (value) => Number.isFinite(value) && value > 0,
    ) ?? [];
  if (alarmOffsets.length > 0) {
    for (const minutesBefore of alarmOffsets) {
      lines.push(...buildValarmLines(minutesBefore));
    }
  } else if (event.alarmMinutesBefore && event.alarmMinutesBefore > 0) {
    lines.push(...buildValarmLines(event.alarmMinutesBefore));
  }

  lines.push("END:VEVENT");
  return lines;
};

export const buildIcsCalendar = (
  events: IcalEventInput[],
  calendarName = "Nomi",
): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sigma by Latino Business Support//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    lines.push(...buildVeventLines(event));
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcalLine).join(CRLF)}${CRLF}`;
};
