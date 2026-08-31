import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Outlined floating label: label sits on the border line when active,
 * so the control stays normal field height (h-9).
 *
 * Convention: new create/edit CRM entry fields using admin inputs should pass
 * `labelVariant="floating"` so forms match the New account design system.
 */
export const floatingFieldShellClassName =
  "relative flex w-full items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20 dark:has-[[aria-invalid=true]]:ring-destructive/40";

export const floatingFieldControlClassName =
  "h-9 w-full border-0 bg-transparent px-3 text-sm shadow-none outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

export const floatingFieldLabelClassName = (active: boolean) =>
  cn(
    "pointer-events-none absolute left-2.5 z-10 origin-left px-1 transition-[top,transform,font-size,color,background-color] duration-150 ease-out",
    active
      ? "-top-2 translate-y-0 bg-background text-[11px] font-medium leading-none text-muted-foreground"
      : "top-1/2 -translate-y-1/2 bg-transparent text-sm text-muted-foreground",
  );

export const FloatingFieldShell = ({
  active,
  label,
  htmlFor,
  required,
  error,
  className,
  children,
}: {
  active: boolean;
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(floatingFieldShellClassName, className)}
    data-floating-active={active ? "true" : "false"}
    data-error={error ? "true" : undefined}
  >
    <label
      htmlFor={htmlFor}
      className={floatingFieldLabelClassName(active)}
      data-error={error ? "true" : undefined}
    >
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
    {children}
  </div>
);
