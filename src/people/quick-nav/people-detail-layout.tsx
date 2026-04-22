import { useState, type ReactNode } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PeopleQuickNav } from "./people-quick-nav";
import type { PeopleQuickNavItem as QuickItem, PeopleQuickNavType } from "./types";
import { PeopleQuickNavSearch } from "./people-quick-nav-search";
import { PeopleQuickNavList } from "./people-quick-nav-list";

const mobileBrowseLabel: Record<PeopleQuickNavType, string> = {
  employee: "Browse employees",
  salesperson: "Browse salespeople",
  subcontractor: "Browse subcontractors",
};

const mobileTitle: Record<PeopleQuickNavType, string> = {
  employee: "Employees",
  salesperson: "Salespeople",
  subcontractor: "Subcontractors",
};

export const PeopleDetailLayout = ({
  type,
  onBack,
  items,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  collapsed,
  onToggleCollapsed,
  isLoading,
  children,
}: {
  type: PeopleQuickNavType;
  onBack: () => void;
  items: QuickItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isLoading?: boolean;
  children: ReactNode;
}) => {
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(id);
    if (isMobile) setMobileSheetOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-hidden">
      {!isMobile ? (
        <PeopleQuickNav
          type={type}
          onBack={onBack}
          collapsed={collapsed}
          query={query}
          onQueryChange={onQueryChange}
          items={items}
          selectedId={selectedId}
          onSelect={handleSelect}
          isLoading={isLoading}
          onToggleCollapsed={onToggleCollapsed}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileSheetOpen(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              {mobileBrowseLabel[type]}
            </Button>
          </div>
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetContent side="left" className="w-[88vw] sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{mobileTitle[type]}</SheetTitle>
                <SheetDescription>Quick navigation</SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-2">
                <PeopleQuickNavSearch
                  value={query}
                  onChange={onQueryChange}
                  placeholder={`Search ${mobileTitle[type].toLowerCase()} (${items.length})`}
                  label={`Search ${mobileTitle[type].toLowerCase()}`}
                />
                <div className="max-h-[72vh] overflow-auto pr-1">
                  <PeopleQuickNavList
                    type={type}
                    items={items}
                    activeId={selectedId}
                    isLoading={isLoading}
                    onSelect={handleSelect}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      <div className="min-w-0 min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};
