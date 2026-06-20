import {
  Activity,
  CheckSquare,
  Package,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WORK_CATEGORY_OPTIONS } from "@/modules/work/workCategoryUtils";
import type { WorkCategory } from "@/modules/work/workTypes";

const CATEGORY_ICONS: Record<WorkCategory, LucideIcon> = {
  task: CheckSquare,
  meeting: Users,
  delivery: Package,
  activity: Activity,
  follow_up: Phone,
};

export const WorkCreateCategoryPicker = ({
  value,
  onChange,
}: {
  value: WorkCategory;
  onChange: (next: WorkCategory) => void;
}) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
    {WORK_CATEGORY_OPTIONS.map((option) => {
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

export const isTaskWorkCategory = (category: WorkCategory) =>
  category === "task" || category === "delivery";

export const isMeetingWorkCategory = (category: WorkCategory) =>
  category === "meeting";
