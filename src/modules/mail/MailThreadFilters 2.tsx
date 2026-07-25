import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MailFolderId } from "./MailFolderRail";
import type { MailListFilter } from "./mailListFilters";
import {
  MailSyncActionIcons,
  type MailSyncToolbarProps,
} from "./MailToolbar";

export function MailThreadFilters({
  folder,
  listFilter,
  onListFilterChange,
  searchQuery,
  onSearchQueryChange,
  syncToolbar,
}: {
  folder: MailFolderId;
  listFilter: MailListFilter;
  onListFilterChange: (next: MailListFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  syncToolbar?: MailSyncToolbarProps;
}) {
  const searchField = (
    <div className="flex shrink-0 items-center gap-1 px-2 pb-2 pt-1">
      <Input
        className="h-8 min-w-0 flex-1 border-0 bg-muted/50 shadow-none focus-visible:ring-1"
        placeholder="Search mail…"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        aria-label="Search mail"
      />
      {syncToolbar ? <MailSyncActionIcons {...syncToolbar} /> : null}
    </div>
  );

  if (folder === "trash" || folder === "spam") {
    return (
      <div className="shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          {[
            { id: "all" as const, label: "All mail" },
            { id: "unread" as const, label: "Unread" },
          ].map((option) => {
            const active = listFilter === option.id;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "h-7 shrink-0 px-2.5 text-xs",
                  active && "bg-muted font-medium",
                )}
                onClick={() => onListFilterChange(option.id)}
                aria-pressed={active}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        {searchField}
      </div>
    );
  }

  return <div className="shrink-0">{searchField}</div>;
}
