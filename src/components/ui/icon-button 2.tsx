import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type IconButtonProps = Omit<
  ButtonProps,
  "size" | "leftIcon" | "rightIcon"
> & {
  /** Required for accessibility — icon-only controls must name the action. */
  "aria-label": string
}

/**
 * Shared 32×32 icon-only button. Prefer this over `Button size="icon"` + size overrides.
 * Default: ghost (toolbar / chrome). Pass `variant="secondary"` for bordered chrome.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, variant = "ghost", type = "button", ...props },
    ref
  ) {
    return (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size="icon"
        className={cn("shrink-0", className)}
        {...props}
      />
    )
  }
)
