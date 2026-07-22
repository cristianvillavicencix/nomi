import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * In-page module chrome row (search / filters / view / create).
 * Pair with header `PageActions` that only teleports the page title —
 * keep product-wide controls (Ask, notifications, global search) in the top bar.
 */
export const ModuleToolbar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3",
      className,
    )}
  >
    {children}
  </div>
);

export const ModuleToolbarSpacer = () => <div className="min-w-0 flex-1" />;

export const ModuleToolbarActions = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end",
      className,
    )}
  >
    {children}
  </div>
);

/** Singular → plural helper for count suffixes in search placeholders. */
export const formatModuleItemCount = (
  total: number | null | undefined,
  singular: string,
  plural?: string,
) => {
  if (typeof total !== "number") return null;
  const label = total === 1 ? singular : (plural ?? `${singular}s`);
  return `${total.toLocaleString()} ${label}`;
};

/**
 * Standard module search field: h-8, icon, optional “· N items” in placeholder.
 * Use as the leading child of ModuleToolbar (replaces ModuleToolbarSpacer).
 *
 * Outer shell is `flex-1` so actions pin right; the input itself stays
 * `sm:max-w-lg` (Accounts chrome pattern).
 */
export const ModuleSearchField = ({
  value,
  onChange,
  basePlaceholder,
  total,
  itemSingular,
  itemPlural,
  className,
  inputClassName,
  fillHeight = false,
}: {
  value: string;
  onChange: (next: string) => void;
  basePlaceholder: string;
  total?: number | null;
  itemSingular?: string;
  itemPlural?: string;
  className?: string;
  inputClassName?: string;
  /** Stretch input to fill parent height (e.g. KPI strip row). */
  fillHeight?: boolean;
}) => {
  const countLabel =
    itemSingular != null
      ? formatModuleItemCount(total, itemSingular, itemPlural)
      : null;
  const placeholder = countLabel
    ? `${basePlaceholder} · ${countLabel}`
    : basePlaceholder;
  const ariaLabel = countLabel
    ? `Search among ${countLabel}`
    : basePlaceholder;

  return (
    <div className={cn("min-w-0 flex-1", fillHeight && "flex h-full", className)}>
      <div
        className={cn(
          "relative w-full",
          fillHeight ? "h-full" : "sm:max-w-lg",
        )}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(fillHeight ? "h-full min-h-[44px]" : "h-8", "pl-9", inputClassName)}
        />
      </div>
    </div>
  );
};
