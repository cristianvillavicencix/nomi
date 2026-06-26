import type { TaskStats } from "@/components/atomic-crm/tasks/taskStats";

export const ProjectTaskStats = ({
  stats,
  variant = "default",
}: {
  stats: TaskStats;
  variant?: "default" | "compact";
}) => {
  if (variant === "compact") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{stats.open}</span> open
        </span>
        {stats.overdue > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="font-medium text-destructive">
              {stats.overdue}
            </span>
            <span>overdue</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>
          <span className="font-medium text-foreground">
            {stats.dueThisWeek}
          </span>{" "}
          due
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="rounded-md border bg-muted/40 px-2.5 py-1">
        <span className="font-medium">{stats.open}</span>{" "}
        <span className="text-muted-foreground">open</span>
      </span>
      {stats.overdue > 0 ? (
        <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-destructive">
          <span className="font-medium">{stats.overdue}</span> overdue
        </span>
      ) : null}
      <span className="rounded-md border bg-muted/40 px-2.5 py-1">
        <span className="font-medium">{stats.dueThisWeek}</span>{" "}
        <span className="text-muted-foreground">due this week</span>
      </span>
    </div>
  );
};
