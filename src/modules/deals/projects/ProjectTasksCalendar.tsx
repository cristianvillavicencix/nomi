import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task as TaskRecord } from "@/modules/types";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const toDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  // Build key as YYYY-MM-DD in local time so it matches calendar cells.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfMonth = (year: number, month: number) => new Date(year, month, 1);

const getMonthDays = (year: number, month: number) => {
  const first = startOfMonth(year, month);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; key: string } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ date, key: toDateKey(date)! });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export type CalendarFilterValue = {
  dateKey: string;
  label: string;
} | null;

export const ProjectTasksCalendar = ({
  tasks,
  value,
  onChange,
}: {
  tasks: TaskRecord[];
  value: CalendarFilterValue;
  onChange: (next: CalendarFilterValue) => void;
}) => {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      const raw =
        (task as { due_date?: string | null; done_date?: string | null })
          .due_date ??
        (task as { done_date?: string | null }).done_date ??
        null;
      if (!raw) continue;
      const key = toDateKey(raw);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const todayKey = toDateKey(today);
  const cells = useMemo(
    () => getMonthDays(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const handleSelect = (date: Date, key: string) => {
    if (value?.dateKey === key) {
      onChange(null);
      return;
    }
    onChange({
      dateKey: key,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  };

  return (
    <div className="bg-muted/30 rounded-md border p-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Previous month"
          onClick={() =>
            setCursor(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() - 1, 1),
            )
          }
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="text-[11px] font-semibold capitalize">
          {monthLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Next month"
          onClick={() =>
            setCursor(
              (current) =>
                new Date(current.getFullYear(), current.getMonth() + 1, 1),
            )
          }
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="text-muted-foreground text-center text-[10px] uppercase"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="h-7" />;
          }
          const count = taskCountByDate.get(cell.key) ?? 0;
          const isToday = cell.key === todayKey;
          const isSelected = value?.dateKey === cell.key;
          const hasTasks = count > 0;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => handleSelect(cell.date, cell.key)}
              className={cn(
                "relative flex h-7 flex-col items-center justify-center rounded text-[11px] transition-colors",
                "hover:bg-sidebar-accent/70",
                isSelected &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent",
                !isSelected && isToday && "ring-1 ring-border",
                !isSelected && hasTasks && "font-semibold",
              )}
            >
              <span>{cell.date.getDate()}</span>
              {hasTasks && !isSelected ? (
                <span className="absolute bottom-0.5 size-1 rounded-full bg-foreground/70" />
              ) : null}
            </button>
          );
        })}
      </div>
      {value ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-[11px]">
            Filtered to {value.label}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => onChange(null)}
          >
            Clear
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export { toDateKey };
