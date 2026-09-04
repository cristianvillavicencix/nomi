import type { MouseEvent } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToolbarLabel } from "@/components/atomic-crm/layout/PageActions";
import { cn } from "@/lib/utils";
import { getNewDealRequestFormPath } from "@/modules/deals/projectCreatePaths";

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

type NewDealCreateButtonProps = {
  className?: string;
  manualTo?: string;
  requestFormTo?: string;
};

/** Primary action: create deal manually. Chevron menu: send client request form. */
export const NewDealCreateButton = ({
  className,
  manualTo = "/deals/create?mode=manual",
  requestFormTo = getNewDealRequestFormPath(),
}: NewDealCreateButtonProps) => {
  const navigate = useNavigate();

  return (
    <div className={cn("flex items-stretch", className)}>
      <Link
        to={manualTo}
        aria-label="New project"
        className={cn(
          buttonVariants({ variant: "primary", size: "md" }),
          "rounded-r-none border-r-0 pr-3",
        )}
        onClick={stopPropagation}
      >
        <Plus />
        <ToolbarLabel priority="primary">New project</ToolbarLabel>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "primary", size: "md" }),
            "rounded-l-none px-2",
          )}
        >
          <ChevronDown className="size-4" />
          <span className="sr-only">More new project options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(requestFormTo)}>
            Request form
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
