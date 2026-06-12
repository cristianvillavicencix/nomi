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
  LBS_CLIENTS_NAV_COLLAPSIBLE,
  LBS_NAV_GROUPS,
  LBS_NAV_STANDALONE,
  type LbsNavCollapsibleGroup,
  type LbsNavItem,
} from "@/app/navigation";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";

const LBS_NAV_ACCENT = "#378ADD";

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
  const { state: sidebarState } = useSidebar();

  const isActive = useCallback(
    (pattern: string) => matchesNavPattern(pattern, location.pathname),
    [location.pathname],
  );

  const standaloneItems = useMemo(
    () => filterAccessibleItems(identity, LBS_NAV_STANDALONE),
    [identity],
  );

  const clientsNavChildren = useMemo(
    () => filterAccessibleItems(identity, LBS_CLIENTS_NAV_COLLAPSIBLE.children),
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

  const clientsSectionActive = useMemo(
    () =>
      clientsNavChildren.some((item) => isActive(item.activePattern)) ||
      isActive("/clients/*"),
    [clientsNavChildren, isActive],
  );

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
            {group.id === "pipeline" && clientsNavChildren.length > 0 ? (
              <ClientsCollapsibleNav
                group={LBS_CLIENTS_NAV_COLLAPSIBLE}
                childrenItems={clientsNavChildren}
                isActive={isActive}
                sectionActive={clientsSectionActive}
                collapsed={sidebarState === "collapsed"}
              />
            ) : null}
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

const ClientsCollapsibleNav = ({
  group,
  childrenItems,
  isActive,
  sectionActive,
  collapsed,
}: {
  group: LbsNavCollapsibleGroup;
  childrenItems: LbsNavItem[];
  isActive: (pattern: string) => boolean;
  sectionActive: boolean;
  collapsed: boolean;
  badgeCount?: number;
}) => {
  const [open, setOpen] = useState(() =>
    readStoredOpen(group.storageKey, sectionActive),
  );

  useEffect(() => {
    if (sectionActive) {
      setOpen(true);
    }
  }, [sectionActive]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(group.storageKey, String(next));
  };

  const ParentIcon = group.icon;

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex size-8 w-full items-center justify-center rounded-lg transition-colors",
                "hover:bg-sidebar-accent/70 text-sidebar-foreground",
              )}
              aria-label={group.label}
            >
              <ParentIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-40">
            {childrenItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.activePattern);
              return (
                <DropdownMenuItem key={item.to} asChild>
                  <Link
                    to={item.to}
                    state={{ _scrollToTop: true }}
                    className={cn(active && "font-medium text-[#378ADD]")}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <SidebarMenuItem>
        <button
          type="button"
          onClick={toggleOpen}
          className={cn(
            "relative flex w-full items-center gap-2 rounded-lg py-1.5 px-2.5 text-sm transition-colors",
            "hover:bg-sidebar-accent/70 text-sidebar-foreground",
          )}
          aria-expanded={open}
        >
          <ParentIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{group.label}</span>
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
          {childrenItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.activePattern);
            return (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton asChild isActive={active}>
                  <Link
                    to={item.to}
                    state={{ _scrollToTop: true }}
                    className={cn(
                      active &&
                        "bg-[#378ADD]/10 font-medium dark:bg-[#378ADD]/15",
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
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      ) : null}
    </>
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
