import { useMemo } from "react";
import type { TaskParticipant } from "@/components/atomic-crm/types";
import { parseDateKey, toDateKey } from "@/modules/calendar/calendarUtils";
import { groupWorkItemsByDateKey } from "@/modules/work/workCategoryUtils";
import { WorkEventRow, WorkTaskRow } from "@/modules/work/WorkListView";
import type { WorkItem } from "@/modules/work/workTypes";

const formatDateHeading = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  const todayKey = toDateKey(new Date());
  const label = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return dateKey === todayKey ? `Today · ${label}` : label;
};

export const WorkCalendarListView = ({
  items,
  participantsByTaskId,
  onSelectItem,
  emptyMessage,
}: {
  items: WorkItem[];
  participantsByTaskId: Record<string, TaskParticipant[]>;
  onSelectItem: (item: WorkItem) => void;
  emptyMessage: string;
}) => {
  const sections = useMemo(() => groupWorkItemsByDateKey(items), [items]);

  if (sections.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="hidden grid-cols-[minmax(0,1fr)_140px_72px_40px] gap-3 border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Item</span>
        <span className="hidden md:inline">Project</span>
        <span className="text-right">Time</span>
        <span className="sr-only">Assignee</span>
      </div>
      <div className="divide-y">
        {sections.map((section) => (
          <section key={section.dateKey}>
            <div className="border-b bg-muted/20 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {formatDateHeading(section.dateKey)} · {section.items.length}
            </div>
            <ul className="space-y-1 p-2">
              {section.items.map((item) => (
                <li key={item.id}>
                  {item.event.kind === "task" ? (
                    <WorkTaskRow
                      item={item}
                      task={item.event.task}
                      participants={
                        participantsByTaskId[String(item.event.task.id)] ?? []
                      }
                      onSelect={onSelectItem}
                    />
                  ) : (
                    <WorkEventRow item={item} onSelect={onSelectItem} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
