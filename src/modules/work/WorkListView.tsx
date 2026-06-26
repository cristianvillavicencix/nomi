import { Link } from "react-router";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TaskAssignedAvatars } from "@/components/atomic-crm/tasks/TaskAssignedAvatars";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import { getWorkCategoryMeta } from "@/modules/work/workCategoryUtils";
import type { WorkItem } from "@/modules/work/workTypes";
import { cn } from "@/lib/utils";

const ROW_CLASS =
  "flex items-center gap-3 rounded-sm border bg-card px-3 py-2 transition-colors hover:bg-muted/20";

const formatDueLabel = (item: WorkItem) => {
  if (item.time) return item.time.slice(0, 5);
  const [, month, day] = item.date.split("-");
  return `${Number(month)}/${Number(day)}`;
};

const WorkListItemBody = ({
  item,
  categoryMeta,
  onSelect,
  description,
  trailing,
}: {
  item: WorkItem;
  categoryMeta: ReturnType<typeof getWorkCategoryMeta>;
  onSelect: (item: WorkItem) => void;
  description: ReactNode;
  trailing?: ReactNode;
}) => (
  <button
    type="button"
    onClick={() => onSelect(item)}
    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
  >
    <span
      className={cn(
        "shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        categoryMeta.chipClass,
      )}
    >
      {categoryMeta.label}
    </span>
    <span className="min-w-0 flex-1 truncate text-sm">{description}</span>
    {item.dealName ? (
      <span className="hidden shrink-0 truncate text-xs text-muted-foreground md:inline md:max-w-[140px]">
        {item.dealId ? (
          <Link
            to={`/deals/${item.dealId}/show`}
            className="hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {item.dealName}
          </Link>
        ) : (
          item.dealName
        )}
      </span>
    ) : null}
    <span
      className={cn(
        "shrink-0 text-xs tabular-nums",
        item.overdue ? "font-medium text-destructive" : "text-muted-foreground",
      )}
    >
      {formatDueLabel(item)}
    </span>
    {trailing}
  </button>
);

const WorkTaskRow = ({
  item,
  task,
  participants,
  onSelect,
}: {
  item: WorkItem;
  task: Task;
  participants: TaskParticipant[];
  onSelect: (item: WorkItem) => void;
}) => {
  const categoryMeta = getWorkCategoryMeta(item.category);
  const { toggle, checkboxChecked, checkboxDisabled, isPending } =
    useTaskCompletionToggle(task, participants);
  const isDone = Boolean(task.done_date);

  return (
    <div className={cn(ROW_CLASS, item.done && "opacity-60")}>
      <Checkbox
        checked={checkboxChecked}
        disabled={checkboxDisabled || isPending}
        onCheckedChange={() => toggle()}
        aria-label="Mark task complete"
      />
      <WorkListItemBody
        item={item}
        categoryMeta={categoryMeta}
        onSelect={onSelect}
        description={
          <TaskDescriptionCell
            text={task.text}
            isDone={isDone}
            enablePreview={false}
            fadeSurface="card"
          />
        }
        trailing={
          <TaskAssignedAvatars
            task={task}
            participants={participants}
            max={1}
            className="shrink-0"
          />
        }
      />
    </div>
  );
};

const WorkEventRow = ({
  item,
  onSelect,
}: {
  item: WorkItem;
  onSelect: (item: WorkItem) => void;
}) => {
  const categoryMeta = getWorkCategoryMeta(item.category);
  return (
    <div className={ROW_CLASS}>
      <span className="size-4 shrink-0" aria-hidden />
      <WorkListItemBody
        item={item}
        categoryMeta={categoryMeta}
        onSelect={onSelect}
        description={item.title}
        trailing={
          item.assigneeInitials ? (
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {item.assigneeInitials}
            </span>
          ) : null
        }
      />
    </div>
  );
};

export const WorkListView = ({
  groupedItems,
  participantsByTaskId,
  onSelectItem,
  emptyMessage,
  doneMode = false,
}: {
  groupedItems: {
    overdue: WorkItem[];
    today: WorkItem[];
    upcoming: WorkItem[];
  };
  participantsByTaskId: Record<string, TaskParticipant[]>;
  onSelectItem: (item: WorkItem) => void;
  emptyMessage: string;
  doneMode?: boolean;
}) => {
  const sections = doneMode
    ? [{ key: "today" as const, items: groupedItems.today }]
    : [
        { key: "overdue" as const, items: groupedItems.overdue },
        { key: "today" as const, items: groupedItems.today },
        { key: "upcoming" as const, items: groupedItems.upcoming },
      ].filter((section) => section.items.length > 0);

  const defaultOpenSections = useMemo(
    () => sections.map((section) => section.key),
    [sections],
  );

  const sectionLabel = (
    key: (typeof sections)[number]["key"],
    count: number,
  ) => {
    if (key === "overdue") return `Overdue ${count}`;
    if (key === "today" && doneMode) return `Completed ${count}`;
    if (key === "today") {
      const dateLabel = new Date().toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      return `Today · ${dateLabel} ${count}`;
    }
    return `Upcoming ${count}`;
  };

  const totalCount =
    groupedItems.overdue.length +
    groupedItems.today.length +
    groupedItems.upcoming.length;

  if (totalCount === 0) {
    return (
      <p className="rounded-sm border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Accordion
        type="multiple"
        defaultValue={defaultOpenSections}
        className="space-y-1"
      >
        {sections.map((section) => (
          <AccordionItem
            key={section.key}
            value={section.key}
            className="border-none"
          >
            <AccordionTrigger className="py-2 text-sm font-semibold text-muted-foreground hover:no-underline">
              {sectionLabel(section.key, section.items.length)}
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <ul className="space-y-1.5">
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
