import { cn } from "@/lib/utils";
import { WORK_CATEGORY_OPTIONS } from "@/modules/work/workCategoryUtils";
import {
  ALL_WORK_CATEGORIES,
  areAllWorkCategoriesSelected,
  soloWorkCategory,
  toggleWorkCategory,
} from "@/modules/work/useWorkPreferences";
import type { WorkCategory } from "@/modules/work/workTypes";

const resolveCategorySelection = (
  selected: WorkCategory[],
  category: WorkCategory,
): WorkCategory[] => {
  const allSelected = areAllWorkCategoriesSelected(selected);
  const onlyThis =
    selected.length === 1 && selected[0] === category;

  // From full set → show only this type (what users expect for "Meetings").
  if (allSelected) {
    return soloWorkCategory(category);
  }
  // Already solo on this type → back to all.
  if (onlyThis) {
    return [...ALL_WORK_CATEGORIES];
  }
  // Otherwise toggle visibility among a partial set.
  return toggleWorkCategory(selected, category);
};

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
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!allSelected ? (
        <button
          type="button"
          onClick={() => onChange([...ALL_WORK_CATEGORIES])}
          className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          All
        </button>
      ) : null}
      {WORK_CATEGORY_OPTIONS.map((option) => {
        const active = selected.includes(option.value);
        const solo =
          selected.length === 1 && selected[0] === option.value;
        const count = counts?.[option.value];
        return (
          <button
            key={option.value}
            type="button"
            title={
              allSelected
                ? "Show only this type"
                : solo
                  ? "Click again to show all types"
                  : active
                    ? "Click to hide this type"
                    : "Click to show this type"
            }
            aria-pressed={active}
            onClick={() =>
              onChange(resolveCategorySelection(selected, option.value))
            }
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              active
                ? option.chipClass
                : "border-transparent bg-muted/30 text-muted-foreground opacity-55 hover:opacity-80",
              solo && "ring-2 ring-primary/30 ring-offset-1",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                active ? option.dotClass : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {option.label}
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
