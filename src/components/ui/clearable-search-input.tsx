import { Search, X } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ClearableSearchInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (next: string) => void;
  /** Hide the leading search icon (default shown). */
  hideSearchIcon?: boolean;
};

/**
 * Controlled search field with a clear (X) button once text is present.
 * Prefer {@link ModuleSearchField} for list toolbars; use this for one-off search UIs.
 */
export const ClearableSearchInput = ({
  value,
  onChange,
  className,
  hideSearchIcon = false,
  ...rest
}: ClearableSearchInputProps) => {
  const hasValue = value.length > 0;

  return (
    <div className="relative min-w-0 w-full">
      {!hideSearchIcon ? (
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      ) : null}
      <Input
        {...rest}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          !hideSearchIcon && "pl-9",
          hasValue && "pr-9",
          className,
        )}
      />
      {hasValue ? (
        <button
          type="button"
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
};
