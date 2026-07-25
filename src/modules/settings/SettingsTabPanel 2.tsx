import type { ReactNode } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PanelBodyProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Flat content area — no card chrome; the hub layout already frames the page. */
export const SettingsPanelBody = ({
  title,
  description,
  children,
  className,
}: PanelBodyProps) => (
  <div className={cn("w-full min-w-0 self-stretch", className)}>
    {title ? (
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
    ) : null}
    {description ? (
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
    ) : null}
    <div className="w-full">{children}</div>
  </div>
);

type SettingsTabPanelProps = PanelBodyProps & {
  value: string;
};

export const SettingsTabPanel = ({
  value,
  title,
  description,
  children,
  className,
}: SettingsTabPanelProps) => (
  <TabsContent
    value={value}
    className="mt-0 w-full focus-visible:outline-none"
  >
    <SettingsPanelBody
      title={title}
      description={description}
      className={className}
    >
      {children}
    </SettingsPanelBody>
  </TabsContent>
);
