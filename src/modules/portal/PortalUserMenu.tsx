import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortalCopy } from "@/modules/portal/portalI18n";

export const PortalUserMenu = ({
  copy,
  accountEmail,
  onSignOut,
}: {
  copy: PortalCopy;
  accountEmail?: string | null;
  onSignOut: () => void;
}) => {
  const label = accountEmail?.trim() || copy.portalLoginEmailFallback;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-xs"
        >
          <UserRound className="size-3.5" />
          <span className="max-w-[140px] truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">
            {copy.portalAccount}
          </div>
          <div className="truncate text-sm font-medium text-foreground">
            {label}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onSignOut()}
        >
          <LogOut className="size-4" />
          {copy.portalSignOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
