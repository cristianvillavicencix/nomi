import type { LucideIcon, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { ExternalLink, Loader2, Search, X } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { entitySearchPopoverClassName } from "@/modules/shared/referenceAutocompleteOptions";

export const entityInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export type EntityDetailLine = {
  key: string;
  icon?: LucideIcon;
  text: string;
};

export const SelectedEntityRow = ({
  title,
  subtitle,
  details,
  profileHref,
  onRemove,
  removeAriaLabel = "Remove selection",
}: {
  title: string;
  subtitle?: string;
  details?: EntityDetailLine[];
  profileHref?: string;
  onRemove: () => void;
  removeAriaLabel?: string;
}) => (
  <div className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2.5">
    <Avatar className="size-8 shrink-0">
      <AvatarFallback className="text-xs">{entityInitials(title)}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="truncate text-sm font-medium leading-tight">{title}</p>
      {subtitle ? (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
      {details?.map(({ key, icon: Icon, text }) => (
        <p
          key={key}
          className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground"
        >
          {Icon ? (
            <Icon className="mt-0.5 size-3 shrink-0" aria-hidden />
          ) : null}
          <span className="min-w-0 break-words">{text}</span>
        </p>
      ))}
    </div>
    <div className="flex shrink-0 items-center">
      {profileHref ? (
        <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
          <Link
            to={profileHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open profile"
          >
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onRemove}
        aria-label={removeAriaLabel}
      >
        <X className="size-4" />
      </Button>
    </div>
  </div>
);

type EntitySearchToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  searchPlaceholder: string;
  addButtonLabel: string;
  addButtonIcon: ReactNode;
  onAddClick: () => void;
  isFetching?: boolean;
  emptyMessage: string;
  emptySearchMessage: string;
  groupHeading: string;
  children: ReactNode;
};

export const EntitySearchToolbar = ({
  searchQuery,
  onSearchQueryChange,
  searchOpen,
  onSearchOpenChange,
  searchPlaceholder,
  addButtonLabel,
  addButtonIcon,
  onAddClick,
  isFetching = false,
  emptyMessage,
  emptySearchMessage,
  groupHeading,
  children,
}: EntitySearchToolbarProps) => {
  const trimmedSearch = searchQuery.trim();
  const anchorRef = useRef<HTMLDivElement>(null);
  const suppressCloseRef = useRef(false);

  const scheduleSuppressClose = useCallback(() => {
    suppressCloseRef.current = true;
    window.requestAnimationFrame(() => {
      suppressCloseRef.current = false;
    });
  }, []);

  const handleSearchOpenChange = useCallback(
    (open: boolean) => {
      if (!open && suppressCloseRef.current) {
        return;
      }
      onSearchOpenChange(open);
    },
    [onSearchOpenChange],
  );

  const handlePopoverInteractOutside = useCallback((event: Event) => {
    if (anchorRef.current?.contains(event.target as Node)) {
      event.preventDefault();
    }
  }, []);

  const stopScrollPropagation = useCallback(
    (event: React.WheelEvent | React.TouchEvent) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Popover open={searchOpen} onOpenChange={handleSearchOpenChange}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                onSearchQueryChange(event.target.value);
                if (!searchOpen) onSearchOpenChange(true);
              }}
              onFocus={() => onSearchOpenChange(true)}
              onPointerDown={scheduleSuppressClose}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-expanded={searchOpen}
              aria-autocomplete="list"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className={entitySearchPopoverClassName}
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={handlePopoverInteractOutside}
          onPointerDownOutside={handlePopoverInteractOutside}
          onWheel={stopScrollPropagation}
          onTouchMove={stopScrollPropagation}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-[min(18rem,50vh)]">
              {isFetching ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : (
                children ?? (
                  <CommandEmpty>
                    {trimmedSearch ? emptySearchMessage : emptyMessage}
                  </CommandEmpty>
                )
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        className="shrink-0 gap-2 sm:w-auto"
        onClick={onAddClick}
      >
        {addButtonIcon}
        {addButtonLabel}
      </Button>
    </div>
  );
};

export const EntitySearchOption = ({
  label,
  sublabel,
  selected,
  onSelect,
}: {
  label: string;
  sublabel?: string;
  details?: string[];
  selected: boolean;
  onSelect: () => void;
}) => (
  <CommandItem
    value={`${label} ${sublabel ?? ""}`.trim()}
    onSelect={onSelect}
  >
    <CheckIcon selected={selected} />
    <p className="min-w-0 flex-1 truncate text-sm leading-snug">
      <span className="font-medium">{label}</span>
      {sublabel ? (
        <span className="text-muted-foreground"> · {sublabel}</span>
      ) : null}
    </p>
  </CommandItem>
);

const CheckIcon = ({ selected }: { selected: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("mr-2 size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const EntitySearchGroup = ({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) => <CommandGroup heading={heading}>{children}</CommandGroup>;
