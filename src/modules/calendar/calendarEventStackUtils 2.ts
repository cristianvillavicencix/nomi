import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import type { TimedCalendarBlock } from "@/modules/calendar/calendarTimeGridUtils";

/** Fan deck for 2–3 events; 4+ collapse into one overflow chip. */
export const TIME_SLOT_FAN_MAX = 3;

export const shouldUseTimeSlotOverflow = (count: number) =>
  count > TIME_SLOT_FAN_MAX;

export const getEventTimeSlotKey = (event: CalendarEvent) => {
  if (!("time" in event) || !event.time?.trim()) {
    return "__untimed__";
  }
  return event.time.trim().slice(0, 5);
};

export const groupEventsByTimeSlot = (events: CalendarEvent[]) => {
  const order: string[] = [];
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = getEventTimeSlotKey(event);
    if (!groups.has(key)) {
      order.push(key);
    }
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return order
    .map((key) => groups.get(key) ?? [])
    .filter((group) => group.length > 0);
};

export const groupTimedBlocksByStart = (blocks: TimedCalendarBlock[]) => {
  const order: number[] = [];
  const groups = new Map<number, TimedCalendarBlock[]>();

  for (const block of blocks) {
    if (!groups.has(block.topPx)) {
      order.push(block.topPx);
    }
    const group = groups.get(block.topPx) ?? [];
    group.push(block);
    groups.set(block.topPx, group);
  }

  return order.map((topPx) => groups.get(topPx) ?? []).filter(Boolean);
};
