import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import {
  getEventDurationMinutes,
  getEventStartMinutes,
  parseTimeToMinutes,
} from "@/modules/calendar/calendarTimeGridUtils";

export type HourOccupancy = {
  hour: number;
  occupiedMinutes: number;
  ratio: number;
};

export const getOccupancyBackgroundClass = (ratio: number) => {
  if (ratio <= 0) return "";
  if (ratio <= 0.25) return "bg-primary/5";
  if (ratio <= 0.5) return "bg-primary/10";
  if (ratio <= 0.75) return "bg-primary/20";
  return "bg-primary/30";
};

export const computeHourOccupancy = ({
  events,
  startHour,
  endHour,
}: {
  events: CalendarEvent[];
  startHour: number;
  endHour: number;
}): HourOccupancy[] => {
  const results: HourOccupancy[] = [];

  for (let hour = startHour; hour < endHour; hour += 1) {
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    let occupiedMinutes = 0;

    for (const event of events) {
      const startMinutes = getEventStartMinutes(event);
      if (startMinutes == null) continue;
      const duration = getEventDurationMinutes(event);
      const eventStart = startMinutes;
      const eventEnd = startMinutes + duration;
      const overlapStart = Math.max(eventStart, hourStart);
      const overlapEnd = Math.min(eventEnd, hourEnd);
      if (overlapEnd > overlapStart) {
        occupiedMinutes += overlapEnd - overlapStart;
      }
    }

    results.push({
      hour,
      occupiedMinutes: Math.min(occupiedMinutes, 60),
      ratio: Math.min(occupiedMinutes / 60, 1),
    });
  }

  return results;
};

export const isHourWithinBusinessWindow = (
  hour: number,
  dayStartHour: number,
  dayEndHour: number,
) => hour >= dayStartHour && hour < dayEndHour;

export const formatHourLabelFromMinutes = (hour: number) => {
  const minutes = hour * 60;
  const normalized = parseTimeToMinutes(
    `${String(hour).padStart(2, "0")}:00:00`,
  );
  if (normalized == null) return `${hour}:00`;
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};
