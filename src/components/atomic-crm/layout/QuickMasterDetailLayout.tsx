import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelRightOpen, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type QuickNavItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

export const QuickMasterDetailLayout = ({
  sidebarTitle,
  sidebarSubtitle,
  searchPlaceholder,
  mobileBrowseLabel,
  items,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  collapsed,
  onToggleCollapsed,
  isLoading,
  scrollStorageKey,
  children,
}: {
  sidebarTitle: string;
  sidebarSubtitle: string;
  searchPlaceholder: string;
  mobileBrowseLabel: string;
  items: QuickNavItem[];
  selectedId?: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isLoading?: boolean;
  scrollStorageKey?: string;
  children: ReactNode;
}) => {
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollStorageKey || collapsed) return;
    const node = listScrollRef.current;
    if (!node) return;
    const stored = sessionStorage.getItem(scrollStorageKey);
    if (!stored) return;
    const scrollTop = Number(stored);
    if (Number.isFinite(scrollTop)) {
      node.scrollTop = scrollTop;
    }
  }, [collapsed, scrollStorageKey]);

  const persistScrollPosition = (scrollTop: number) => {
    if (!scrollStorageKey) return;
    sessionStorage.setItem(scrollStorageKey, String(scrollTop));
  };

  const onSelectAndClose = (id: string) => {
    onSelect(id);
    if (isMobile) setMobileSheetOpen(false);
  };

  const quickList = (
    <>
      <div className={cn("px-3 py-3", collapsed ? "flex justify-center px-2" : "space-y-3")}>
        {!collapsed ? (
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{sidebarTitle}</h3>
              <p className="text-xs text-muted-foreground">{sidebarSubtitle}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              aria-label="Collapse quick navigation"
              title="Collapse quick navigation"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              aria-label="Expand quick navigation"
              title="Expand quick navigation"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
            <span className="rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
              Quick navigation
            </span>
          </div>
        )}
        {!collapsed ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        ) : null}
      </div>
      {!collapsed ? (
        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-auto px-2 pb-2"
          onScroll={(event) => persistScrollPosition(event.currentTarget.scrollTop)}
        >
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-1 py-2 text-sm text-muted-foreground">No results found.</div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    String(item.id) === String(selectedId ?? "") && "border-primary/40 bg-secondary/60",
                  )}
                  onClick={() => onSelectAndClose(item.id)}
                >
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.subtitle || item.meta || "—"}
                  </div>
                  {item.meta && item.subtitle ? (
                    <div className="text-[11px] text-muted-foreground truncate">{item.meta}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-hidden">
      {!isMobile ? (
        <aside
          className={cn(
            "hidden xl:flex h-full min-h-0 shrink-0 self-start flex-col transition-all duration-200",
            collapsed ? "w-12" : "w-[17rem] 2xl:w-[18rem]",
          )}
        >
          {quickList}
        </aside>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setMobileSheetOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              {mobileBrowseLabel}
            </Button>
          </div>
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetContent side="left" className="w-[88vw] sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{sidebarTitle}</SheetTitle>
                <SheetDescription>{sidebarSubtitle}</SheetDescription>
              </SheetHeader>
              <div className="h-[calc(100dvh-7rem)] min-h-0">{quickList}</div>
            </SheetContent>
          </Sheet>
        </>
      )}
      <div className="min-w-0 min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};
