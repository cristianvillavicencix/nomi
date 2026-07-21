import { CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MailFolderId } from "./MailFolderRail";
import type { MailListFilter } from "./mailListFilters";
import {
  MailSyncActionIcons,
  type MailSyncToolbarProps,
} from "./MailToolbar";

const PRIMARY: Array<{ id: MailListFilter; label: string }> = [
  { id: "all", label: "All mail" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
];

const OTHER: Array<{ id: MailListFilter; label: string }> = [
  { id: "archived", label: "Archived" },
];

export function MailThreadFilters({
  folder,
  listFilter,
  onListFilterChange,
  searchQuery,
  onSearchQueryChange,
  counts,
  syncToolbar,
}: {
  folder: MailFolderId;
  listFilter: MailListFilter;
  onListFilterChange: (next: MailListFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  counts?: Partial<Record<MailListFilter, number>>;
  syncToolbar?: MailSyncToolbarProps;
}) {
  const showStarred = folder === "inbox";
  const showOthers = folder === "inbox";
  const options = showStarred
    ? PRIMARY
    : PRIMARY.filter((o) => o.id !== "starred");

  const otherActive = OTHER.some((o) => o.id === listFilter);

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

  if (folder === "draft") {
    return (
      <div className="shrink-0">
        <div className="flex items-center gap-1 px-2 py-2">
          <span className="px-2 text-xs font-medium text-foreground">
            All drafts
          </span>
        </div>
        {searchField}
      </div>
    );
  }

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

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const active = listFilter === option.id;
        const count = counts?.[option.id];
        return (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={active ? "secondary" : "ghost"}
            className={cn(
              "h-7 shrink-0 gap-1.5 px-2.5 text-xs",
              active && "bg-muted font-medium",
            )}
            onClick={() => onListFilterChange(option.id)}
            aria-pressed={active}
          >
            {option.label}
            {count != null && count > 0 ? (
              <span
                className={cn(
                  "tabular-nums text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </Button>
        );
      })}

      {showOthers ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={otherActive ? "secondary" : "ghost"}
              className={cn(
                "h-7 shrink-0 gap-1 px-2.5 text-xs",
                otherActive && "bg-muted font-medium",
              )}
            >
              Others
              <CaretDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {OTHER.map((option) => (
              <DropdownMenuItem
                key={option.id}
                onClick={() => onListFilterChange(option.id)}
              >
                {option.label}
                {counts?.[option.id] != null && counts[option.id]! > 0
                  ? ` (${counts[option.id]})`
                  : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      </div>
      {searchField}
    </div>
  );
}
