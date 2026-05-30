import { useEffect, useState } from "react";
import { Building2, PanelLeftOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ContactCompanySidebar } from "@/lbs/contacts/ContactCompanySidebar";
import type { ComponentProps } from "react";

const STORAGE_KEY = "lbs_contact_company_sidebar_collapsed";

type ContactCollapsibleCompanySidebarProps = ComponentProps<
  typeof ContactCompanySidebar
>;

const usePersistedCollapsed = () => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
};

export const ContactCollapsibleCompanySidebar = (
  props: ContactCollapsibleCompanySidebarProps,
) => {
  const [collapsed, setCollapsed] = usePersistedCollapsed();

  if (collapsed) {
    return (
      <aside
        className={cn(
          "sticky top-2 flex w-10 shrink-0 flex-col items-center gap-3 self-start rounded-lg border bg-card py-3",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Show company panel"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show panel</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
              <Building2 className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">Company</TooltipContent>
        </Tooltip>

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
              aria-label="Hide company panel"
              onClick={() => setCollapsed(true)}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide panel</TooltipContent>
        </Tooltip>
      </div>
      <ContactCompanySidebar {...props} />
    </aside>
  );
};
