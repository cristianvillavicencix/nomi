import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CollapsedRelatedIcon = {
  key: string;
  icon: ReactNode;
  count?: number;
  label: string;
};

export const CollapsibleRelatedPanel = ({
  storageKey,
  collapsedIcons,
  children,
}: {
  storageKey: string;
  collapsedIcons: CollapsedRelatedIcon[];
  children: ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(storageKey) === "true";
  });

  useEffect(() => {
    sessionStorage.setItem(storageKey, String(collapsed));
  }, [collapsed, storageKey]);

  if (collapsed) {
    return (
      <aside className="sticky top-2 flex w-10 shrink-0 flex-col items-center gap-3 self-start py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Show related panel"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show panel</TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {collapsedIcons.map((item) => (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-0.5">
                  {item.icon}
                  {item.count != null && item.count > 0 ? (
                    <span className="text-[10px] font-medium tabular-nums">
                      {item.count}
                    </span>
                  ) : null}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                {item.label}
                {item.count != null && item.count > 0 ? ` (${item.count})` : ""}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <span className="mt-1 rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Related
        </span>
      </aside>
    );
  }

  return (
    <aside className="sticky top-2 w-[300px] min-w-0 shrink-0 space-y-2 self-start">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-medium text-muted-foreground">Related</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Hide related panel"
              onClick={() => setCollapsed(true)}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide panel</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </aside>
  );
};
