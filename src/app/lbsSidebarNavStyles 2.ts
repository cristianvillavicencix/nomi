import { cn } from "@/lib/utils";

/** Shared shadcn sidebar nav styles — neutral gray/black, no brand accent. */
export const sidebarNavLinkClass = (active: boolean) =>
  cn(
    "relative flex w-full items-center gap-2 rounded-sm py-1.5 px-2.5 text-sm transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground",
  );

export const sidebarNavLinkCollapsedClass = (active: boolean) =>
  cn(
    "relative flex size-9 w-full items-center justify-center rounded-sm transition-colors",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground",
  );

export const sidebarNavSubLinkClass = (active: boolean) =>
  cn(active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground");

export const sidebarNavDropdownItemClass = (active: boolean) =>
  cn(active && "font-medium text-foreground");
