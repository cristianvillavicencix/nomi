import { useGetIdentity } from "ra-core";
import { ChevronDown } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import {
  filterLbsNavGroups,
  LBS_ACCOUNTS_NAV_ITEM,
  LBS_CLIENTS_NAV_ITEM,
  LBS_MORE_NAV_COLLAPSIBLE,
  LBS_NAV_AFTER_CLIENTS,
  LBS_NAV_GROUPS,
  LBS_NAV_STANDALONE,
  LBS_NAV_STANDALONE_WITH_ACCOUNTS_HUB,
  splitLbsNavGroups,
  type LbsNavCollapsibleSection,
  type LbsNavGroup,
  type LbsNavItem,
} from "@/app/navigation";
import { getAccessibleClientsHubTabs } from "@/modules/clients/clientsHubAccess";
import { canAccessAccountsHub } from "@/modules/accounts/accountsHubAccess";
import { isAccountsHubEnabled } from "@/lib/featureFlags";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";

import {
  sidebarNavDropdownItemClass,
  sidebarNavIconClass,
  sidebarNavLinkClass,
  sidebarNavLinkCollapsedClass,
  sidebarNavSubLinkClass,
} from "@/app/lbsSidebarNavStyles";

// Stable refs to avoid creating new objects on every render, which makes
// Radix Slot (used by TooltipTrigger asChild) treat the Link as changed props
// and re-run composeRefs in a loop. See React.Slot internals.
const LINK_STATE = { _scrollToTop: true } as const;

const matchesNavPattern = (pattern: string, pathname: string) => {
  if (pattern === "/") return pathname === "/";
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return !!matchPath(pattern, pathname);
};

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

const readStoredOpen = (storageKey: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(storageKey);
  if (stored === null) return fallback;
  return stored === "true";
};

const isClientsNavActive = (pathname: string) =>
  matchesNavPattern("/clients/*", pathname) ||
  matchesNavPattern("/companies/*", pathname) ||
  matchesNavPattern("/contacts/*", pathname);

const isAccountsNavActive = (pathname: string) =>
  matchesNavPattern("/accounts/*", pathname) ||
  matchesNavPattern("/leads/*", pathname) ||
  matchesNavPattern("/clients/*", pathname) ||
  matchesNavPattern("/companies/*", pathname) ||
  matchesNavPattern("/contacts/*", pathname);

type LbsSidebarNavProps = {
  websiteMonitorEnabled: boolean;
  messagesUnreadCount: number;
  ticketsNotificationUnread: number;
};

export const LbsSidebarNav = ({
  websiteMonitorEnabled,
  messagesUnreadCount,
  ticketsNotificationUnread,
}: LbsSidebarNavProps) => {
  const location = useLocation();
  const { data: identity } = useGetIdentity();
  const { state: sidebarState } = useSidebar();

  const isActive = useCallback(
    (pattern: string) => matchesNavPattern(pattern, location.pathname),
    [location.pathname],
  );

  const accountsHub = isAccountsHubEnabled();

  const standaloneItems = useMemo(
    () =>
      filterAccessibleItems(
        identity,
        accountsHub ? LBS_NAV_STANDALONE_WITH_ACCOUNTS_HUB : LBS_NAV_STANDALONE,
      ),
    [accountsHub, identity],
  );

  const afterClientsItems = useMemo(
    () => filterAccessibleItems(identity, LBS_NAV_AFTER_CLIENTS),
    [identity],
  );

  const hubNavItem = useMemo(() => {
    if (!identity) return null;
    if (accountsHub) {
      return canAccessAccountsHub(identity) ? LBS_ACCOUNTS_NAV_ITEM : null;
    }
    return getAccessibleClientsHubTabs(identity).length > 0
      ? LBS_CLIENTS_NAV_ITEM
      : null;
  }, [accountsHub, identity]);

  const navGroups = useMemo(() => {
    const groups = filterLbsNavGroups(LBS_NAV_GROUPS, {
      websiteMonitorEnabled,
    });
    return groups
      .map((group) => ({
        ...group,
        items: filterAccessibleItems(identity, group.items),
      }))
      .filter((group) => group.items.length > 0);
  }, [identity, websiteMonitorEnabled]);

  const { primary: primaryNavGroups, secondary: secondaryNavGroups } = useMemo(
    () => splitLbsNavGroups(navGroups),
    [navGroups],
  );

  const hasPrimaryNav =
    standaloneItems.length > 0 ||
    hubNavItem != null ||
    afterClientsItems.length > 0 ||
    primaryNavGroups.length > 0;

  const secondarySectionActive = useMemo(
    () =>
      secondaryNavGroups.some((group) =>
        group.items.some((item) => isActive(item.activePattern)),
      ),
    [secondaryNavGroups, isActive],
  );

  return (
    <SidebarGroup className="gap-0 p-2">
      {standaloneItems.length > 0 || hubNavItem ? (
        <SidebarMenu className="group-data-[collapsible=icon]:gap-1.5">
          {standaloneItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              item={item}
              active={isActive(item.activePattern)}
              collapsed={sidebarState === "collapsed"}
            />
          ))}
          {hubNavItem ? (
            <SidebarNavLink
              key={hubNavItem.to}
              item={hubNavItem}
              active={
                accountsHub
                  ? isAccountsNavActive(location.pathname)
                  : isClientsNavActive(location.pathname)
              }
              collapsed={sidebarState === "collapsed"}
            />
          ) : null}
        </SidebarMenu>
      ) : null}

      {afterClientsItems.length > 0 ? (
        <SidebarMenu className="group-data-[collapsible=icon]:gap-1.5">
          {afterClientsItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              item={item}
              active={isActive(item.activePattern)}
              badgeCount={
                item.to === "/messages"
                  ? messagesUnreadCount
                  : item.to === "/tickets"
                    ? ticketsNotificationUnread
                    : 0
              }
              collapsed={sidebarState === "collapsed"}
            />
          ))}
        </SidebarMenu>
      ) : null}

      {primaryNavGroups.map((group, index) => {
        const hasItemsAbove =
          standaloneItems.length > 0 ||
          hubNavItem != null ||
          afterClientsItems.length > 0 ||
          index > 0;
        return (
          <div
            key={group.id}
            className={cn(
              hasItemsAbove &&
                "group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border/60 group-data-[collapsible=icon]:pt-2",
            )}
          >
            <SidebarGroupLabel
              className={cn(
                "h-auto px-0.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                "group-data-[collapsible=icon]:pointer-events-none",
                index === 0 && !hasPrimaryNav ? "mt-0" : "mt-2",
              )}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className="group-data-[collapsible=icon]:gap-1.5">
              {group.items.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  item={item}
                  active={isActive(item.activePattern)}
                  collapsed={sidebarState === "collapsed"}
                />
              ))}
            </SidebarMenu>
          </div>
        );
      })}

      {secondaryNavGroups.length > 0 ? (
        <div
          className={cn(
            hasPrimaryNav &&
              "group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border/60 group-data-[collapsible=icon]:pt-2",
          )}
        >
          <MoreCollapsibleNav
            section={LBS_MORE_NAV_COLLAPSIBLE}
            groups={secondaryNavGroups}
            isActive={isActive}
            sectionActive={secondarySectionActive}
            collapsed={sidebarState === "collapsed"}
          />
        </div>
      ) : null}
    </SidebarGroup>
  );
};

const MoreCollapsibleNav = ({
  section,
  groups,
  isActive,
  sectionActive,
  collapsed,
}: {
  section: LbsNavCollapsibleSection;
  groups: LbsNavGroup[];
  isActive: (pattern: string) => boolean;
  sectionActive: boolean;
  collapsed: boolean;
}) => {
  const [open, setOpen] = useState(() =>
    readStoredOpen(section.storageKey, sectionActive),
  );

  useEffect(() => {
    if (sectionActive) {
      setOpen(true);
    }
  }, [sectionActive]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(section.storageKey, String(next));
  };

  const ParentIcon = section.icon;

  if (collapsed) {
    return (
      <SidebarMenu className="group-data-[collapsible=icon]:gap-1.5">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={section.label}
              title={section.label}
              className={sidebarNavLinkCollapsedClass(sectionActive)}
            >
              <ParentIcon className={sidebarNavIconClass(sectionActive)} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="min-w-44"
            >
              {groups.map((group, groupIndex) => (
                <div key={group.id}>
                  {groupIndex > 0 ? (
                    <div className="my-1 border-t border-border/60" />
                  ) : null}
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.activePattern);
                    return (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link
                          to={item.to}
                          state={LINK_STATE}
                          className={sidebarNavDropdownItemClass(active)}
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:gap-1.5">
      <SidebarMenuItem>
        <button
          type="button"
          onClick={toggleOpen}
          className={cn(
            "relative flex w-full items-center gap-2 rounded-sm py-1.5 px-2.5 text-sm transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground",
            sectionActive && !open && "font-medium",
          )}
          aria-expanded={open}
        >
          <ParentIcon className={sidebarNavIconClass(sectionActive)} />
          <span className="truncate">{section.label}</span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </SidebarMenuItem>
      {open ? (
        <SidebarMenuSub className="mx-2.5 border-l border-sidebar-border/80 px-2">
          {groups.map((group, groupIndex) => (
            <div key={group.id} className={cn(groupIndex > 0 && "mt-2")}>
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.activePattern);
                return (
                  <SidebarMenuSubItem key={item.to}>
                    <SidebarMenuSubButton asChild isActive={active}>
                      <Link
                        to={item.to}
                        state={LINK_STATE}
                        className={sidebarNavSubLinkClass(active)}
                      >
                        <Icon className={sidebarNavIconClass(active)} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </div>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenu>
  );
};

const SidebarNavLink = ({
  item,
  active,
  badgeCount = 0,
  collapsed = false,
}: {
  item: LbsNavItem;
  active: boolean;
  badgeCount?: number;
  collapsed?: boolean;
}) => {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <Link
          to={item.to}
          state={LINK_STATE}
          aria-label={item.label}
          title={item.label}
          className={sidebarNavLinkCollapsedClass(active)}
        >
          <Icon className={sidebarNavIconClass(active)} />
          {badgeCount > 0 ? (
            <NavBadge
              count={badgeCount}
              className="absolute -top-0.5 -right-0.5"
            />
          ) : null}
        </Link>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Link
        to={item.to}
        state={LINK_STATE}
        className={sidebarNavLinkClass(active)}
      >
        <Icon className={sidebarNavIconClass(active)} />
        <span className="truncate">{item.label}</span>
        {badgeCount > 0 ? (
          <NavBadge count={badgeCount} className="ml-auto" />
        ) : null}
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
    className={cn("rounded-sm border-0 px-1.5 py-0 text-[10px]", className)}
  >
    {formatUnreadBadgeCount(count)}
  </Badge>
);
