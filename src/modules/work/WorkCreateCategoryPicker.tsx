import {
  CalendarClock,
  CheckSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORK_CREATE_CATEGORY_OPTIONS,
  type WorkCreateCategory,
} from "@/modules/work/workCreateCategories";

const CATEGORY_ICONS: Record<WorkCreateCategory, LucideIcon> = {
  task: CheckSquare,
  meeting: Users,
  scheduled_event: CalendarClock,
};

export const WorkCreateCategoryPicker = ({
  value,
  onChange,
}: {
  value: WorkCreateCategory;
  onChange: (next: WorkCreateCategory) => void;
}) => (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
    {WORK_CREATE_CATEGORY_OPTIONS.map((option) => {
      const Icon = CATEGORY_ICONS[option.value];
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-sm border px-2 py-2.5 text-xs font-medium transition-colors",
            active
              ? option.chipClass
              : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {option.label}
        </button>
      );
    })}
  </div>
);
