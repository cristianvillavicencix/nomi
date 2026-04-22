import { Skeleton } from "@/components/ui/skeleton";
import type { PeopleQuickNavItem as QuickItem, PeopleQuickNavType } from "./types";
import { EmployeeQuickNavItem } from "./employee-quick-nav-item";
import { SalespersonQuickNavItem } from "./salesperson-quick-nav-item";
import { SubcontractorQuickNavItem } from "./subcontractor-quick-nav-item";

const emptyLabelByType: Record<PeopleQuickNavType, string> = {
  employee: "No employees found.",
  salesperson: "No salespeople found.",
  subcontractor: "No subcontractors found.",
};

export const PeopleQuickNavList = ({
  type,
  items,
  activeId,
  isLoading,
  onSelect,
}: {
  type: PeopleQuickNavType;
  items: QuickItem[];
  activeId?: string | null;
  isLoading?: boolean;
  onSelect: (id: string) => void;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="px-1 py-2 text-sm text-muted-foreground">{emptyLabelByType[type]}</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const active = String(item.id) === String(activeId ?? "");
        if (type === "employee") {
          return (
            <EmployeeQuickNavItem
              key={item.id}
              item={item}
              active={active}
              onSelect={onSelect}
            />
          );
        }
        if (type === "salesperson") {
          return (
            <SalespersonQuickNavItem
              key={item.id}
              item={item}
              active={active}
              onSelect={onSelect}
            />
          );
        }
        return (
          <SubcontractorQuickNavItem
            key={item.id}
            item={item}
            active={active}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
};

