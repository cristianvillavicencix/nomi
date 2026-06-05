import { ChevronRight } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import {
  filterLbsNavGroups,
  LBS_NAV_GROUPS,
  LBS_NAV_STANDALONE,
  type LbsNavGroup,
  type LbsNavItem,
} from "@/lbs/navigation";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";

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
    <>
      {standaloneItems.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            {standaloneItems.map((item) => (
              <SidebarNavLink
                key={item.to}
                item={item}
                active={isActive(item.activePattern)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}

      {navGroups.map((group) => (
        <LbsSidebarNavGroup
          key={group.id}
          group={group}
          isActive={isActive}
          messagesUnreadCount={messagesUnreadCount}
        />
      ))}
    </>
  );
};

const LbsSidebarNavGroup = ({
  group,
  isActive,
  messagesUnreadCount,
}: {
  group: LbsNavGroup;
  isActive: (pattern: string) => boolean;
  messagesUnreadCount: number;
}) => {
  const location = useLocation();
  const groupHasActiveChild = group.items.some((item) =>
    isActive(item.activePattern),
  );
  const [open, setOpen] = useState(groupHasActiveChild);

  useEffect(() => {
    if (groupHasActiveChild) {
      setOpen(true);
    }
  }, [groupHasActiveChild, location.pathname]);

  const GroupIcon = group.icon;
  const groupUnread = group.items.reduce(
    (count, item) =>
      item.to === "/messages" ? count + messagesUnreadCount : count,
    0,
  );

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            onClick={() => setOpen((value) => !value)}
            isActive={groupHasActiveChild}
            className="justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <GroupIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{group.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {groupUnread > 0 ? (
                <Badge
                  variant="default"
                  className="rounded-full border-0 bg-blue-500 px-1.5 py-0 text-[10px] text-white group-data-[collapsible=icon]:hidden"
                >
                  {formatUnreadBadgeCount(groupUnread)}
                </Badge>
              ) : null}
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden",
                  open && "rotate-90",
                )}
              />
            </span>
          </SidebarMenuButton>
          {open ? (
            <SidebarMenuSub>
              {group.items.map((item) => (
                <SidebarNavSubLink
                  key={item.to}
                  item={item}
                  active={isActive(item.activePattern)}
                  badgeCount={
                    item.to === "/messages" ? messagesUnreadCount : 0
                  }
                />
              ))}
            </SidebarMenuSub>
          ) : null}
        </SidebarMenuItem>
      </SidebarMenu>
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
      <SidebarMenuButton asChild isActive={active}>
        <Link to={item.to} state={{ _scrollToTop: true }} className="relative">
          <Icon className="h-4 w-4" />
          <span className="truncate">{item.label}</span>
          {badgeCount > 0 ? (
            <NavBadge count={badgeCount} />
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const SidebarNavSubLink = ({
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
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link to={item.to} state={{ _scrollToTop: true }} className="relative">
          <Icon className="h-4 w-4" />
          <span className="truncate">{item.label}</span>
          {badgeCount > 0 ? (
            <NavBadge count={badgeCount} className="ml-auto" />
          ) : null}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
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
      "rounded-full border-0 bg-blue-500 px-1.5 py-0 text-[10px] text-white",
      className,
    )}
  >
    {formatUnreadBadgeCount(count)}
  </Badge>
);
