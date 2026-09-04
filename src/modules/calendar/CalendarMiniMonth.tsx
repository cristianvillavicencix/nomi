import { useMemo, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import {
  addMonths,
  formatMonthLabel,
  getMonthGridDays,
  getWeekdayLabel,
  isSameDay,
  isSameMonth,
  parseDateKey,
  toDateKey,
} from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

/** 0 at range start (cool) → 1 at delivery (warm). */
export const dayRangeProgress = (
  dateKey: string,
  startKey: string,
  endKey: string,
): number | null => {
  const day = parseDateKey(dateKey).getTime();
  const start = parseDateKey(startKey).getTime();
  const end = parseDateKey(endKey).getTime();
  if (Number.isNaN(day) || Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end < start) return null;
  if (day < start || day > end) return null;
  if (end === start) return 1;
  return (day - start) / (end - start);
};

const rangeTintStyle = (
  progress: number,
  isDeliveryDay: boolean,
): CSSProperties => {
  // Sky → amber as we approach official delivery.
  const hue = 198 - progress * 160;
  const alpha = isDeliveryDay
    ? 0.55
    : 0.1 + progress * 0.32;
  return {
    backgroundColor: `hsl(${hue} 82% 48% / ${Math.min(alpha, 0.6)})`,
  };
};

export const CalendarMiniMonth = ({
  anchor,
  selectedDateKey,
  dotsByDate,
  rangeStartDateKey,
  rangeEndDateKey,
  onSelectDay,
  onAnchorChange,
}: {
  anchor: Date;
  selectedDateKey: string;
  dotsByDate: Record<string, string[]>;
  /** Inclusive project timeline: creation/start → delivery. */
  rangeStartDateKey?: string | null;
  rangeEndDateKey?: string | null;
  onSelectDay: (dateKey: string) => void;
  onAnchorChange?: (next: Date) => void;
}) => {
  const days = getMonthGridDays(anchor);
  const today = new Date();
  const headerDays = days.slice(0, 7);
  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [days]);

  return (
    <div className="space-y-3">
      {onAnchorChange ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{formatMonthLabel(anchor)}</h2>
          <div className="flex items-center gap-1">
            <IconButton
              onClick={() => onAnchorChange(addMonths(anchor, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton
              onClick={() => onAnchorChange(addMonths(anchor, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {headerDays.map((day) => (
            <div
              key={toDateKey(day)}
              className="px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground"
            >
              {getWeekdayLabel(day)}
            </div>
          ))}
        </div>
        <div>
          {weekRows.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((day) => {
                const dateKey = toDateKey(day);
                const dots = dotsByDate[dateKey] ?? [];
                const inMonth = isSameMonth(day, anchor);
                const isToday = isSameDay(day, today);
                const isSelected = dateKey === selectedDateKey;
                const hasItems = dots.length > 0;
                const progress =
                  rangeStartDateKey && rangeEndDateKey
                    ? dayRangeProgress(
                        dateKey,
                        rangeStartDateKey,
                        rangeEndDateKey,
                      )
                    : null;
                const isDeliveryDay =
                  Boolean(rangeEndDateKey) && dateKey === rangeEndDateKey;
                const isStartDay =
                  Boolean(rangeStartDateKey) && dateKey === rangeStartDateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => onSelectDay(dateKey)}
                    style={
                      progress != null && inMonth
                        ? rangeTintStyle(progress, isDeliveryDay)
                        : undefined
                    }
                    className={cn(
                      "flex min-h-[42px] flex-col items-center gap-0.5 border-b border-r px-1 py-1 text-xs transition-colors last:border-r-0 hover:brightness-95",
                      !inMonth && "text-muted-foreground/50",
                      progress == null &&
                        hasItems &&
                        inMonth &&
                        !isToday &&
                        !isSelected &&
                        "bg-sky-500/15",
                      isDeliveryDay &&
                        inMonth &&
                        "ring-2 ring-inset ring-amber-600/70",
                      isStartDay &&
                        inMonth &&
                        !isDeliveryDay &&
                        "ring-1 ring-inset ring-sky-500/40",
                      isToday && "ring-2 ring-inset ring-primary/35",
                      isSelected &&
                        !isToday &&
                        !isDeliveryDay &&
                        "ring-1 ring-inset ring-primary/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full",
                        isToday &&
                          !isDeliveryDay &&
                          "bg-primary font-semibold text-primary-foreground",
                        isDeliveryDay &&
                          inMonth &&
                          "bg-amber-600 font-bold text-white shadow-sm",
                        !isToday &&
                          !isDeliveryDay &&
                          (hasItems || progress != null) &&
                          inMonth &&
                          "font-semibold",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className="flex h-2 items-center gap-0.5">
                      {dots.slice(0, 3).map((dotClass, index) => (
                        <span
                          key={index}
                          className={cn("size-1.5 rounded-full", dotClass)}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const buildCategoryDotsByDate = (
  eventsByDate: Record<
    string,
    Array<{ kind: string; record?: { meeting_url?: string | null } }>
  >,
  getDotClass: (category: string) => string,
) => {
  const map: Record<string, string[]> = {};
  for (const [dateKey, events] of Object.entries(eventsByDate)) {
    map[dateKey] = events.slice(0, 3).map((event) => {
      const category =
        event.kind === "meeting"
          ? "meeting"
          : event.kind === "project_delivery"
            ? "delivery"
            : event.kind === "activity"
              ? "activity"
              : event.kind === "reminder"
                ? "follow_up"
                : "task";
      return getDotClass(category);
    });
  }
  return map;
};
