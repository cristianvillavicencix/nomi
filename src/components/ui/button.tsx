import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { CircleNotch } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  buttonVariants,
  type ButtonVariantProps,
} from "@/components/ui/button.variants";

export type ButtonProps = React.ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
    /** Shows a spinner and disables the button. Width stays stable. */
    isLoading?: boolean;
    /** Phosphor (or any) icon node before the label. */
    leftIcon?: React.ReactNode;
    /** Phosphor (or any) icon node after the label. */
    rightIcon?: React.ReactNode;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    const isIconOnly = size === "icon";
    const isDisabled = Boolean(disabled || isLoading);

    if (
      import.meta.env.DEV &&
      isIconOnly &&
      !props["aria-label"] &&
      !props["aria-labelledby"] &&
      !props.title
    ) {
      console.warn(
        'Button with size="icon" requires aria-label (or aria-labelledby / title).',
      );
    }

    // Do not wrap labeled children in a single <span>: Lucide/Phosphor SVGs are
    // often display:block, which stacks icon above text inside a normal-flow span.
    // Keep icon + label as direct flex children of the button (flex-row).
    const content = asChild ? (
      children
    ) : (
      <>
        {isLoading ? (
          <CircleNotch
            weight="regular"
            className="size-4 shrink-0 grow-0 animate-spin"
            aria-hidden
          />
        ) : leftIcon ? (
          <span
            className="inline-flex size-4 shrink-0 grow-0 items-center justify-center [&_svg]:size-4"
            aria-hidden
          >
            {leftIcon}
          </span>
        ) : null}
        {children ? (
          isLoading && isIconOnly ? (
            <span className="sr-only">{children}</span>
          ) : (
            children
          )
        ) : null}
        {!isLoading && rightIcon ? (
          <span
            className="inline-flex size-4 shrink-0 grow-0 items-center justify-center [&_svg]:size-4"
            aria-hidden
          >
            {rightIcon}
          </span>
        ) : null}
      </>
    );

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant ?? "primary"}
        data-size={size ?? "md"}
        data-loading={isLoading ? "true" : undefined}
        type={asChild ? undefined : type}
        disabled={asChild ? undefined : isDisabled}
        aria-busy={isLoading || undefined}
        aria-disabled={asChild && isDisabled ? true : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);

export { Button, buttonVariants };
