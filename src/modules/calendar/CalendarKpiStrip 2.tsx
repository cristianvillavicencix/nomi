import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const KPI_CARDS = [
  {
    label: "Open",
    subtitle: "Tasks not marked done",
    tooltip: "Count of tasks that have not been marked complete.",
    accent: "text-primary",
  },
  {
    label: "Due today",
    subtitle: "Scheduled for today",
    tooltip: "Tasks and calendar items on today's date.",
    accent: "text-foreground",
  },
  {
    label: "Overdue",
    subtitle: "Past due, still open",
    tooltip: "Open tasks whose due date is before today.",
    accent: "text-red-600 dark:text-red-400",
  },
  {
    label: "Done",
    subtitle: "Completed tasks",
    tooltip: "Tasks marked complete.",
    accent: "text-muted-foreground",
  },
] as const;

export const CalendarKpiStrip = ({
  open,
  done,
  overdue,
  dueToday,
  trailing,
}: {
  open: number;
  done: number;
  overdue: number;
  dueToday: number;
  trailing?: ReactNode;
}) => {
  const values = [open, dueToday, overdue, done];

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_CARDS.map((card, index) => (
        <div
          key={card.label}
          title={card.tooltip}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md border bg-card px-2 py-1.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-none text-foreground">
              {card.label}
            </p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
              {card.subtitle}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums leading-none",
              card.accent,
            )}
          >
            {values[index]}
          </p>
        </div>
      ))}
      </div>
      {trailing ? (
        <div className="flex w-full shrink-0 lg:w-80 xl:w-96">{trailing}</div>
      ) : null}
    </div>
  );
};
