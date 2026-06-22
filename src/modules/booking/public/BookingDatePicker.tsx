import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMonthGridDays,
  getWeekdayLabel,
  isSameMonth,
  toDateKey,
} from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

type BookingDatePickerProps = {
  monthAnchor: Date;
  onMonthChange: (next: Date) => void;
  bookableDates: string[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
};

export const BookingDatePicker = ({
  monthAnchor,
  onMonthChange,
  bookableDates,
  selectedDate,
  onSelectDate,
}: BookingDatePickerProps) => {
  const bookableSet = useMemo(
    () => new Set(bookableDates),
    [bookableDates],
  );

  const days = getMonthGridDays(monthAnchor);
  const monthLabel = monthAnchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(monthAnchor);
    next.setMonth(next.getMonth() + delta, 1);
    onMonthChange(next);
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.slice(0, 7).map((day) => (
          <div
            key={`head-${toDateKey(day)}`}
            className="py-1 text-center text-[11px] font-medium uppercase text-muted-foreground"
          >
            {getWeekdayLabel(day).slice(0, 2)}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const inMonth = isSameMonth(day, monthAnchor);
          const bookable = bookableSet.has(dateKey);
          const selected = selectedDate === dateKey;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!bookable}
              onClick={() => {
                if (bookable) onSelectDate(dateKey);
              }}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !bookable && "text-muted-foreground/30",
                inMonth &&
                  bookable &&
                  !selected &&
                  "font-medium text-foreground hover:bg-muted",
                isWeekend && !bookable && "opacity-40",
                selected &&
                  "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
