import { Link } from "react-router";
import { ArrowsClockwise, CaretDown, GearSix } from "@phosphor-icons/react";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { mailboxesSettingsPath } from "./mailSettingsPath";

/** Sync + settings chrome for the mail reading column (no per-message actions). */
export function MailDetailToolbar({
  className,
  syncing = false,
  onSync,
  onSyncFromDate,
}: {
  className?: string;
  syncing?: boolean;
  onSync: () => void;
  onSyncFromDate?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-0.5 border-b px-2",
        className,
      )}
    >
      <span className="px-2 text-sm font-medium text-muted-foreground">
        Mail
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <IconButtonWithTooltip
          label="Sync mailbox"
          disabled={syncing}
          onClick={onSync}
        >
          <ArrowsClockwise
            className={cn("size-4", syncing && "animate-spin")}
          />
        </IconButtonWithTooltip>
        {onSyncFromDate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButtonWithTooltip
                label="More sync options"
                disabled={syncing}
                className="size-8"
              >
                <CaretDown className="size-3.5" />
              </IconButtonWithTooltip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={syncing} onClick={onSyncFromDate}>
                Sync from date…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton aria-label="Mail settings" asChild>
                <Link to={mailboxesSettingsPath()}>
                  <GearSix className="size-4" />
                </Link>
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>Mail settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

/** @deprecated use MailDetailToolbar */
export const MailToolbar = MailDetailToolbar;
