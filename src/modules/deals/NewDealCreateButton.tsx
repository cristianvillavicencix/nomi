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
import { cn } from "@/lib/utils";
import { getNewDealRequestFormPath } from "@/modules/deals/projectCreatePaths";

const NEW_DEAL_BUTTON_CLASS =
  "bg-black text-white hover:bg-black/90 border-black dark:bg-white dark:text-black dark:hover:bg-white/90";

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
        className={cn(
          buttonVariants({ variant: "outline" }),
          NEW_DEAL_BUTTON_CLASS,
          "rounded-r-none border-r-0 pr-3",
        )}
        onClick={stopPropagation}
      >
        <Plus />
        New deal
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            NEW_DEAL_BUTTON_CLASS,
            "rounded-l-none px-2",
          )}
        >
          <ChevronDown className="size-4" />
          <span className="sr-only">More new deal options</span>
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
