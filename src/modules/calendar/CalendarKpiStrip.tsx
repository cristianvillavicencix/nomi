import { cn } from "@/lib/utils";

export const CalendarKpiStrip = ({
  open,
  done,
  overdue,
  dueToday,
}: {
  open: number;
  done: number;
  overdue: number;
  dueToday: number;
}) => {
  const cards = [
    { label: "Open", value: open, accent: "text-primary" },
    { label: "Due today", value: dueToday, accent: "text-foreground" },
    { label: "Overdue", value: overdue, accent: "text-red-600 dark:text-red-400" },
    { label: "Done", value: done, accent: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border bg-card px-3 py-2.5"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", card.accent)}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
};
