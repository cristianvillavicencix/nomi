import { cn } from "@/lib/utils";
import {
  ALL_WORK_CATEGORIES,
  areAllWorkCategoriesSelected,
} from "@/modules/work/useWorkPreferences";
import type { WorkCategory } from "@/modules/work/workTypes";
import {
  getFilterGroupCount,
  isFilterGroupFullySelected,
  isOnlyFilterGroupSelected,
  resolveFilterGroupSelection,
  WORK_CALENDAR_FILTER_GROUPS,
  type WorkCalendarFilterGroup,
} from "@/modules/work/workCalendarFilterGroups";

export const WorkCategoryChips = ({
  selected,
  onChange,
  counts,
}: {
  selected: WorkCategory[];
  onChange: (next: WorkCategory[]) => void;
  counts?: Partial<Record<WorkCategory, number>>;
}) => {
  const allSelected = areAllWorkCategoriesSelected(selected);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!allSelected ? (
        <button
          type="button"
          onClick={() => onChange([...ALL_WORK_CATEGORIES])}
          className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          All
        </button>
      ) : null}
      {WORK_CALENDAR_FILTER_GROUPS.map((group) => {
        const active = isFilterGroupFullySelected(selected, group);
        const solo = isOnlyFilterGroupSelected(selected, group);
        const count = counts ? getFilterGroupCount(counts, group) : undefined;

        return (
          <button
            key={group.id}
            type="button"
            title={group.title}
            aria-pressed={active}
            onClick={() =>
              onChange(
                resolveFilterGroupSelection(
                  selected,
                  group.id as WorkCalendarFilterGroup,
                ),
              )
            }
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              active
                ? group.chipClass
                : "border-transparent bg-muted/30 text-muted-foreground opacity-55 hover:opacity-80",
              solo && "ring-2 ring-primary/30 ring-offset-1",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                active ? group.dotClass : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {group.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "tabular-nums",
                  active ? "opacity-70" : "opacity-50",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
