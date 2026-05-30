import { cn } from "@/lib/utils";
import { clientSubTabsListClassName } from "@/lbs/clients/ClientTabSectionCard";

export type ClientSectionNavItem = {
  value: string;
  label: string;
};

type ClientSectionNavProps = {
  value: string;
  onChange: (value: string) => void;
  items: ClientSectionNavItem[];
};

export const ClientSectionNav = ({
  value,
  onChange,
  items,
}: ClientSectionNavProps) => (
  <div className={clientSubTabsListClassName} role="tablist">
    {items.map((item) => {
      const active = value === item.value;
      return (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(item.value)}
          className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
            active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);
