import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SettingsSubNavItem<T extends string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: SettingsSubNavItem<T>[];
  /** Multiple tab panels (Radix TabsContent children). */
  children?: ReactNode;
  /** Single shared panel below the tab bar — stable full-width layout. */
  content?: ReactNode;
  className?: string;
  /** Let tab content fill remaining viewport height (split billing workspaces). */
  fillHeight?: boolean;
  /** Tab strip only (e.g. inside MobilePageChrome) — no muted container chrome. */
  embedded?: boolean;
};

export const SettingsSubNav = <T extends string>({
  value,
  onValueChange,
  items,
  children,
  content,
  className,
  fillHeight = false,
  embedded = false,
}: Props<T>) => (
  <Tabs
    value={value}
    onValueChange={(next) => onValueChange(next as T)}
    className={cn(
      "flex w-full min-w-0 flex-col",
      embedded ? "gap-0" : "gap-2",
      className,
    )}
  >
    <TabsList
      className={cn(
        "inline-flex h-10 w-full max-w-full shrink-0 justify-start gap-1 self-stretch overflow-x-auto p-1",
        embedded
          ? "mb-0 rounded-full bg-black/[0.06] dark:bg-white/10"
          : "mb-4",
      )}
    >
      {items.map((item) => (
        <TabsTrigger key={item.id} value={item.id} className="shrink-0">
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {embedded ? null : (
      <div
        className={cn(
          "w-full min-w-0 self-stretch",
          fillHeight && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        {content ?? children}
      </div>
    )}
  </Tabs>
);

export { TabsContent } from "@/components/ui/tabs";
