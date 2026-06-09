import { useGetIdentity } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import {
  filterLbsNavGroups,
  LBS_NAV_GROUPS,
  LBS_NAV_STANDALONE,
  type LbsNavItem,
} from "@/lbs/navigation";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";

const LBS_NAV_ACCENT = "#378ADD";

const canAccessNavItem = (identity: unknown, item: LbsNavItem) => {
  if (item.capability) {
    return hasMemberCapability(identity as any, item.capability);
  }
  if (item.resource) {
    return canAccess(identity as any, {
      resource: item.resource,
      action: item.action ?? "list",
    });
  }
  return true;
};

const filterAccessibleItems = (identity: unknown, items: LbsNavItem[]) =>
  items.filter((item) => canAccessNavItem(identity, item));

type LbsSidebarNavProps = {
  websiteMonitorEnabled: boolean;
  messagesUnreadCount: number;
};

export const LbsSidebarNav = ({
  websiteMonitorEnabled,
  messagesUnreadCount,
}: LbsSidebarNavProps) => {
  const location = useLocation();
  const { data: identity } = useGetIdentity();

  const isActive = (pattern: string) => {
    if (pattern === "/") return location.pathname === "/";
    return !!matchPath(pattern, location.pathname);
  };

  const standaloneItems = useMemo(
    () => filterAccessibleItems(identity, LBS_NAV_STANDALONE),
    [identity],
  );

  const navGroups = useMemo(() => {
    const groups = filterLbsNavGroups(LBS_NAV_GROUPS, { websiteMonitorEnabled });
    return groups
      .map((group) => ({
        ...group,
        items: filterAccessibleItems(identity, group.items),
      }))
      .filter((group) => group.items.length > 0);
  }, [identity, websiteMonitorEnabled]);

  return (
    <SidebarGroup className="gap-0 p-2">
      {standaloneItems.length > 0 ? (
        <SidebarMenu>
          {standaloneItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              item={item}
              active={isActive(item.activePattern)}
            />
          ))}
        </SidebarMenu>
      ) : null}

      {navGroups.map((group, index) => (
        <div key={group.id}>
          <SidebarGroupLabel
            className={cn(
              "h-auto px-0.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              index === 0 && standaloneItems.length === 0 ? "mt-0" : "mt-2",
            )}
          >
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarNavLink
                key={item.to}
                item={item}
                active={isActive(item.activePattern)}
                badgeCount={item.to === "/messages" ? messagesUnreadCount : 0}
              />
            ))}
          </SidebarMenu>
        </div>
      ))}
    </SidebarGroup>
  );
};

const SidebarNavLink = ({
  item,
  active,
  badgeCount = 0,
}: {
  item: LbsNavItem;
  active: boolean;
  badgeCount?: number;
}) => {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <Link
        to={item.to}
        state={{ _scrollToTop: true }}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-lg py-1.5 px-2.5 text-sm transition-colors",
          "hover:bg-sidebar-accent/70",
          active
            ? "bg-[#378ADD]/10 font-medium text-sidebar-foreground dark:bg-[#378ADD]/15"
            : "text-sidebar-foreground",
        )}
        style={
          active
            ? { boxShadow: `inset 2px 0 0 0 ${LBS_NAV_ACCENT}` }
            : undefined
        }
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-[#378ADD]" : "text-muted-foreground",
          )}
        />
        <span className="truncate">{item.label}</span>
        {badgeCount > 0 ? <NavBadge count={badgeCount} className="ml-auto" /> : null}
      </Link>
    </SidebarMenuItem>
  );
};

const NavBadge = ({
  count,
  className,
}: {
  count: number;
  className?: string;
}) => (
  <Badge
    variant="default"
    className={cn(
      "rounded-full border-0 bg-[#378ADD] px-1.5 py-0 text-[10px] text-white",
      className,
    )}
  >
    {formatUnreadBadgeCount(count)}
  </Badge>
);
