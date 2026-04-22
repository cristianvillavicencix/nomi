import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export const ACTION_BAR_SURFACE_CLASSNAME =
  "border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80";

export interface TopToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  surface?: boolean;
}

export const TopToolbar = (inProps: TopToolbarProps) => {
  const { className, children, surface = true, ...props } = inProps;

  return (
    <div
      className={cn(
        "flex flex-auto justify-end items-end gap-2 whitespace-nowrap",
        surface && ACTION_BAR_SURFACE_CLASSNAME,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default TopToolbar;
