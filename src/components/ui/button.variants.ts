import { cva, type VariantProps } from "class-variance-authority";

/**
 * Single source of truth for Button visual variants.
 *
 * Spec variants: primary | secondary | ghost | destructive
 * Spec sizes: sm (32) | md (36, default) | lg (44) | icon (32×32)
 *
 * Legacy aliases (shadcn / existing call sites) stay until migration:
 * - default → primary
 * - outline → secondary
 * - link → text link (ghost-like)
 * - size default → md
 *
 * Prefer `IconButton` for icon-only controls (`src/components/ui/icon-button.tsx`).
 */
export const buttonVariants = cva(
  [
    // flex-row is explicit so icon + label stay on one line (overrides must use twMerge)
    "inline-flex flex-row flex-nowrap items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[8px] text-sm font-medium",
    "transition-[background-color,color,border-color,transform,opacity] duration-150 ease-out",
    "outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:grow-0",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-brand-foreground hover:bg-brand/90 dark:bg-brand dark:hover:bg-brand/90",
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground dark:border-input",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",

        /** @deprecated Use `primary` */
        default:
          "bg-brand text-brand-foreground hover:bg-brand/90 dark:bg-brand dark:hover:bg-brand/90",
        /** @deprecated Use `secondary` */
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground dark:border-input",
        /** @deprecated Prefer `ghost` for tertiary actions */
        link: "bg-transparent text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 min-h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        md: "h-9 min-h-9 px-4 py-2 has-[>svg]:px-3",
        lg: "h-11 min-h-11 px-6 text-base has-[>svg]:px-4",
        /** Square icon-only control — 32×32 to match toolbar / sm height. Requires aria-label. */
        icon: "size-8 min-h-8 min-w-8 p-0",
        /** @deprecated Use `md` */
        default: "h-9 min-h-9 px-4 py-2 has-[>svg]:px-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
