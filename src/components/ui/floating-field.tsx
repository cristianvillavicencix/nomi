import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Outlined floating label: label sits on the border line when active,
 * so the control stays normal field height (h-9).
 *
 * Convention: new create/edit CRM entry fields using admin inputs should pass
 * `labelVariant="floating"` so forms match the New account design system.
 *
 * When inactive, the floating label acts as the placeholder — never show a
 * real placeholder (or native date format text) at the same time or they overlap.
 */
export const floatingFieldShellClassName =
  "relative flex w-full items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20 dark:has-[[aria-invalid=true]]:ring-destructive/40";

export const floatingFieldControlClassName =
  "h-9 w-full border-0 bg-transparent px-3 text-sm shadow-none outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

export const floatingFieldLabelClassName = (
  active: boolean,
  align: "center" | "top" = "center",
) =>
  cn(
    "pointer-events-none absolute left-2.5 z-10 origin-left px-1 transition-[top,transform,font-size,color,background-color] duration-150 ease-out",
    active
      ? "-top-2 translate-y-0 bg-background text-[11px] font-medium leading-none text-muted-foreground"
      : align === "top"
        ? "top-2.5 translate-y-0 bg-transparent text-sm text-muted-foreground"
        : "top-1/2 -translate-y-1/2 bg-transparent text-sm text-muted-foreground",
  );

/** Placeholder only while floating label is raised (focused or filled). */
export const floatingFieldPlaceholder = (
  active: boolean,
  placeholder?: string,
) =>
  active
    ? placeholder && placeholder.trim()
      ? placeholder
      : undefined
    : " ";

/**
 * Hide native date/datetime format ghost text (mm/dd/yyyy) while the floating
 * label is sitting inside an empty field.
 */
export const floatingDateEmptyValueClassName = (active: boolean) =>
  active
    ? undefined
    : "[&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-text]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent [&::-webkit-datetime-edit-hour-field]:text-transparent [&::-webkit-datetime-edit-minute-field]:text-transparent [&::-webkit-datetime-edit-ampm-field]:text-transparent";

export const FloatingFieldShell = ({
  active,
  label,
  htmlFor,
  required,
  error,
  className,
  labelAlign = "center",
  children,
}: {
  active: boolean;
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: boolean;
  className?: string;
  /** Use `top` for multiline fields so the idle label sits on the first line. */
  labelAlign?: "center" | "top";
  children: ReactNode;
}) => (
  <div
    className={cn(floatingFieldShellClassName, className)}
    data-floating-active={active ? "true" : "false"}
    data-error={error ? "true" : undefined}
  >
    <label
      htmlFor={htmlFor}
      className={floatingFieldLabelClassName(active, labelAlign)}
      data-error={error ? "true" : undefined}
    >
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
    {children}
  </div>
);
