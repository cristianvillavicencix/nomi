import { cn } from "@/lib/utils";
import { WORK_CATEGORY_OPTIONS } from "@/modules/work/workCategoryUtils";
import { toggleWorkCategory } from "@/modules/work/useWorkPreferences";
import type { WorkCategory } from "@/modules/work/workTypes";

export const WorkCategoryChips = ({
  selected,
  onChange,
}: {
  selected: WorkCategory[];
  onChange: (next: WorkCategory[]) => void;
}) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    {WORK_CATEGORY_OPTIONS.map((option) => {
      const active = selected.includes(option.value);
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(toggleWorkCategory(selected, option.value))}
          className={cn(
            "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors",
            active
              ? option.chipClass
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              active ? option.dotClass : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          {option.label}
        </button>
      );
    })}
  </div>
);
