import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PageLayout = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
    {children}
  </div>
);

export const StickyPageHeader = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("sticky top-0 z-30 bg-background", className)}>{children}</div>
);

export const StickyActionBar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("sticky top-0 z-20 bg-background", className)}>{children}</div>
);

export const StickyTabsBar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("sticky top-0 z-20 bg-background", className)}>{children}</div>
);

export const ScrollableContentArea = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>
);
