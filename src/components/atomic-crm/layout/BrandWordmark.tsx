import { PRODUCT_FULL_NAME, PRODUCT_ORG } from "@/lib/branding";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  title: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  /** When false, only show the short title (e.g. icon-collapsed chrome). */
  showSubtitle?: boolean;
};

/**
 * Product chrome: short title (SIGMA) + “by Latino Business Support”.
 * Alt text uses the full product line for accessibility.
 */
export function BrandWordmark({
  title,
  className,
  titleClassName,
  subtitleClassName,
  showSubtitle = true,
}: BrandWordmarkProps) {
  return (
    <span className={cn("min-w-0", className)} title={PRODUCT_FULL_NAME}>
      <span
        className={cn(
          "block truncate font-semibold leading-tight",
          titleClassName,
        )}
      >
        {title}
      </span>
      {showSubtitle ? (
        <span
          className={cn(
            "block truncate text-[10px] font-normal leading-tight text-muted-foreground",
            subtitleClassName,
          )}
        >
          by {PRODUCT_ORG}
        </span>
      ) : null}
    </span>
  );
}
