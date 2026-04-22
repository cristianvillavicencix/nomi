import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PeopleQuickNavHeader } from "./people-quick-nav-header";
import { PeopleQuickNavSearch } from "./people-quick-nav-search";
import { PeopleQuickNavList } from "./people-quick-nav-list";
import type { PeopleQuickNavItem as QuickItem, PeopleQuickNavType } from "./types";

const pluralTitle: Record<PeopleQuickNavType, string> = {
  employee: "Employees",
  salesperson: "Salespeople",
  subcontractor: "Subcontractors",
};

const quickNavSubtitleByType: Record<PeopleQuickNavType, string> = {
  employee: "Quick navigation for employees",
  salesperson: "Quick navigation for salespeople",
  subcontractor: "Quick navigation for subcontractors",
};

const searchPlaceholderByType: Record<PeopleQuickNavType, string> = {
  employee: "Search employees",
  salesperson: "Search salespeople",
  subcontractor: "Search subcontractors",
};

export const PeopleQuickNav = ({
  type,
  onBack,
  collapsed,
  query,
  onQueryChange,
  items,
  selectedId,
  onSelect,
  isLoading,
  onToggleCollapsed,
}: {
  type: PeopleQuickNavType;
  onBack: () => void;
  collapsed: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  items: QuickItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  onToggleCollapsed: () => void;
}) => {
  const title = pluralTitle[type];
  const quickNavSubtitle = quickNavSubtitleByType[type];
  const placeholder = `${searchPlaceholderByType[type]} (${items.length})`;
  const label = `Search ${title.toLowerCase()}`;

  const withAll = useMemo(() => items, [items]);

  if (collapsed) {
    return (
      <aside className="hidden xl:flex h-full w-14 shrink-0 self-start flex-col items-center py-3">
        <PeopleQuickNavHeader
          title={title}
          subtitle={quickNavSubtitle}
          onBack={onBack}
          collapsed={collapsed}
          onToggle={onToggleCollapsed}
        />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "hidden xl:flex h-full w-[20rem] shrink-0 self-start flex-col",
        "transition-all duration-200",
      )}
    >
      <div className="px-2 pb-2">
        <div className="mb-3 rounded-lg border bg-card p-3">
          <PeopleQuickNavHeader
            title={title}
            subtitle={quickNavSubtitle}
            onBack={onBack}
            collapsed={collapsed}
            onToggle={onToggleCollapsed}
          />
        </div>
        <PeopleQuickNavSearch
          value={query}
          onChange={onQueryChange}
          placeholder={placeholder}
          label={label}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <PeopleQuickNavList
          type={type}
          items={withAll}
          activeId={selectedId}
          isLoading={isLoading}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
};
