import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useGetList, type RaRecord } from "ra-core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SpotlightSearchButtonProps = {
  title: string;
  description?: string;
  placeholder: string;
  /** Controlled query (legacy). When provided, syncs typing with parent. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** When set, the popup renders live suggestions for this resource. */
  resource?: string;
  /** Extra filter merged into every suggestion query (e.g. status@in=...). */
  filter?: Record<string, unknown>;
  /** Sort applied when query is empty (defaults to created_at DESC). */
  sort?: { field: string; order: "ASC" | "DESC" };
  /** Soft cap on suggestion count (defaults to 8). */
  limit?: number;
  /** Build the URL to navigate to when a suggestion is selected. */
  getHref?: (record: RaRecord) => string;
  /** Render a single suggestion row. */
  renderItem?: (record: RaRecord, isActive: boolean) => ReactNode;
  /** Optional empty-state copy when no matches are found. */
  emptyHint?: string;
};

const DEFAULT_LIMIT = 8;

export const SpotlightSearchButton = ({
  title,
  description,
  placeholder,
  value,
  onValueChange,
  resource,
  filter,
  sort,
  limit = DEFAULT_LIMIT,
  getHref,
  renderItem,
  emptyHint = "No hay coincidencias para tu búsqueda.",
}: SpotlightSearchButtonProps) => {
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState(value ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  const query = value ?? internalQuery;

  useEffect(() => {
    if (value !== undefined) {
      setInternalQuery(value);
    }
  }, [value]);

  const handleQueryChange = useCallback(
    (next: string) => {
      setInternalQuery(next);
      onValueChange?.(next);
      setActiveIndex(0);
    },
    [onValueChange],
  );

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
    }
  }, [open]);

  const trimmedQuery = query.trim();
  const suggestionsEnabled = Boolean(resource && getHref);

  const { data, isFetching } = useGetList(
    resource ?? "contacts",
    {
      pagination: { page: 1, perPage: limit },
      sort: sort ?? { field: "created_at", order: "DESC" },
      filter: trimmedQuery
        ? { ...(filter ?? {}), q: trimmedQuery }
        : (filter ?? {}),
    },
    { enabled: open && suggestionsEnabled, staleTime: 15_000 },
  );

  const suggestions = useMemo(
    () => (data ?? []).slice(0, limit),
    [data, limit],
  );

  const handleSelect = useCallback(
    (record: RaRecord) => {
      if (!getHref) return;
      const href = getHref(record);
      setOpen(false);
      navigate(href);
    },
    [getHref, navigate],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsEnabled || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter") {
      const target = suggestions[activeIndex];
      if (target) {
        event.preventDefault();
        handleSelect(target);
      }
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={title}
        >
          <Search className="h-4 w-4" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/60 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={description ? "spotlight-desc" : undefined}
          className={cn(
            "fixed left-[50%] top-[20%] z-50 w-full max-w-[calc(100%-2rem)]",
            "translate-x-[-50%] rounded-2xl bg-background shadow-2xl ring-1 ring-border/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150 sm:max-w-xl",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description
              id="spotlight-desc"
              className="sr-only"
            >
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="relative flex items-center px-4 py-3">
            <Search className="pointer-events-none size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="ml-3 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <kbd className="ml-2 hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          {suggestionsEnabled ? (
            <>
              <div className="h-px bg-border/60" />
              <div
                ref={listRef}
                className="max-h-[60vh] overflow-y-auto px-2 py-2"
                role="listbox"
              >
                {isFetching && suggestions.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Buscando…
                  </p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {trimmedQuery
                      ? emptyHint
                      : "Empieza a escribir para buscar."}
                  </p>
                ) : (
                  suggestions.map((record, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <button
                        type="button"
                        key={record.id}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelect(record)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        {renderItem ? (
                          renderItem(record, isActive)
                        ) : (
                          <DefaultSuggestionRow record={record} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const DefaultSuggestionRow = ({ record }: { record: RaRecord }) => (
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">
      {(record as any).name ??
        `${(record as any).first_name ?? ""} ${(record as any).last_name ?? ""}`.trim() ??
        String(record.id)}
    </p>
  </div>
);
