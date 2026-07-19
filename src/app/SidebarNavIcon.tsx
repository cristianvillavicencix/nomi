import type { Icon, IconProps, IconWeight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type NavIconComponent = Icon;

export const sidebarNavIconWeight = (active: boolean): IconWeight =>
  active ? "fill" : "regular";

type SidebarNavIconProps = IconProps & {
  icon: Icon;
  active?: boolean;
  className?: string;
};

/** Phosphor nav icon — fill when active, regular otherwise (HubSpot-style). */
export function SidebarNavIcon({
  icon: Icon,
  active = false,
  className,
  weight,
  ...props
}: SidebarNavIconProps) {
  return (
    <Icon
      weight={weight ?? sidebarNavIconWeight(active)}
      className={cn(
        "size-4 shrink-0",
        active ? "text-sidebar-accent-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
