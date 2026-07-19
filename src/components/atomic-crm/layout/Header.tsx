import { useGetIdentity } from "ra-core";
import { CaretDown } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router";
import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterAccessibleNavItems,
  isAccountsNavActive,
  isClientsNavActive,
  matchesNavPattern,
} from "@/app/lbsNavAccess";
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
  type LbsNavItem,
} from "@/app/navigation";
import { SidebarNavIcon } from "@/app/SidebarNavIcon";
import { getAccessibleClientsHubTabs } from "@/modules/clients/clientsHubAccess";
import { canAccessAccountsHub } from "@/modules/accounts/accountsHubAccess";
import { isAccountsHubEnabled } from "@/lib/featureFlags";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";
import { useMessagesUnreadCounts } from "@/modules/messages/useMessagesUnreadCounts";
import { useNotificationUnreadCounts } from "@/modules/notifications/useNotificationUnreadCounts";
import { useWebsiteMonitorEnabled } from "@/modules/settings/useWebsiteMonitorSettings";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { BrandWordmark } from "./BrandWordmark";
import { CRMUserMenuItems } from "./UserMenuItems";
import { sidebarNavDropdownItemClass } from "@/app/lbsSidebarNavStyles";

const LINK_STATE = { _scrollToTop: true } as const;

const TopNavBadge = ({ count }: { count: number }) => (
  <Badge
    variant="destructive"
    className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
  >
    {formatUnreadBadgeCount(count)}
  </Badge>
);

const TopNavLink = ({
  item,
  active,
  badgeCount = 0,
}: {
  item: LbsNavItem;
  active: boolean;
  badgeCount?: number;
}) => (
  <Link
    to={item.to}
    state={LINK_STATE}
    aria-label={item.label}
    className={cn(
      "relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-secondary-foreground/10 text-secondary-foreground"
        : "text-secondary-foreground/70 hover:bg-secondary-foreground/5 hover:text-secondary-foreground",
    )}
  >
    <SidebarNavIcon
      icon={item.icon}
      active={active}
      className={cn(active ? "text-secondary-foreground" : undefined)}
    />
    <span className="whitespace-nowrap">{item.label}</span>
    {badgeCount > 0 ? <TopNavBadge count={badgeCount} /> : null}
  </Link>
);

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const { data: identity } = useGetIdentity();
  const { enabled: websiteMonitorEnabled } = useWebsiteMonitorEnabled(true);
  const { totalUnread: messagesUnreadCount } = useMessagesUnreadCounts();
  const { tickets: ticketsNotificationUnread } = useNotificationUnreadCounts();

  const isActive = useCallback(
    (pattern: string) => matchesNavPattern(pattern, location.pathname),
    [location.pathname],
  );

  const accountsHub = isAccountsHubEnabled();

  const primaryItems = useMemo(() => {
    const standalone = filterAccessibleNavItems(
      identity,
      accountsHub ? LBS_NAV_STANDALONE_WITH_ACCOUNTS_HUB : LBS_NAV_STANDALONE,
    );
    const hub =
      identity == null
        ? null
        : accountsHub
          ? canAccessAccountsHub(identity)
            ? LBS_ACCOUNTS_NAV_ITEM
            : null
          : getAccessibleClientsHubTabs(identity).length > 0
            ? LBS_CLIENTS_NAV_ITEM
            : null;
    const after = filterAccessibleNavItems(identity, LBS_NAV_AFTER_CLIENTS);
    return [...standalone, ...(hub ? [hub] : []), ...after];
  }, [accountsHub, identity]);

  const secondaryNavGroups = useMemo(() => {
    const groups = filterLbsNavGroups(LBS_NAV_GROUPS, {
      websiteMonitorEnabled,
    })
      .map((group) => ({
        ...group,
        items: filterAccessibleNavItems(identity, group.items),
      }))
      .filter((group) => group.items.length > 0);
    return splitLbsNavGroups(groups).secondary;
  }, [identity, websiteMonitorEnabled]);

  const moreSection = LBS_MORE_NAV_COLLAPSIBLE;
  const moreActive = secondaryNavGroups.some((group) =>
    group.items.some((item) => isActive(item.activePattern)),
  );

  const hubActive = (item: LbsNavItem) => {
    if (item.to === "/accounts") return isAccountsNavActive(location.pathname);
    if (item.to === "/clients") return isClientsNavActive(location.pathname);
    return isActive(item.activePattern);
  };

  const badgeFor = (item: LbsNavItem) => {
    if (item.to === "/messages") return messagesUnreadCount;
    if (item.to === "/tickets") return ticketsNotificationUnread;
    return 0;
  };

  return (
    <header className="shrink-0 border-b bg-secondary print:hidden">
      <div className="flex h-12 items-center gap-2 px-3">
        <Link
          to="/"
          state={LINK_STATE}
          className="flex shrink-0 items-center gap-2 text-secondary-foreground no-underline"
        >
          <img
            className="[.light_&]:hidden h-5 w-5 rounded-sm object-cover"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-5 w-5 rounded-sm object-cover"
            src={lightModeLogo}
            alt={title}
          />
          <BrandWordmark
            title={title}
            showSubtitle={false}
            titleClassName="hidden text-sm sm:block"
          />
        </Link>

        <nav
          aria-label="CRM modules"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {primaryItems.map((item) => (
            <TopNavLink
              key={item.to}
              item={item}
              active={hubActive(item)}
              badgeCount={badgeFor(item)}
            />
          ))}

          {secondaryNavGroups.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto shrink-0 gap-1 px-2 py-1.5 text-xs font-medium",
                    moreActive
                      ? "bg-secondary-foreground/10 text-secondary-foreground"
                      : "text-secondary-foreground/70 hover:text-secondary-foreground",
                  )}
                >
                  <SidebarNavIcon
                    icon={moreSection.icon}
                    active={moreActive}
                    className={cn(
                      moreActive ? "text-secondary-foreground" : undefined,
                    )}
                  />
                  {moreSection.label}
                  <CaretDown weight="bold" className="size-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                {secondaryNavGroups.map((group, groupIndex) => (
                  <div key={group.id}>
                    {groupIndex > 0 ? (
                      <div className="my-1 border-t border-border/60" />
                    ) : null}
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const active = isActive(item.activePattern);
                      return (
                        <DropdownMenuItem key={item.to} asChild>
                          <Link
                            to={item.to}
                            state={LINK_STATE}
                            className={sidebarNavDropdownItemClass(active)}
                          >
                            <SidebarNavIcon icon={item.icon} active={active} />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeModeToggle />
          <UserMenu>
            <CRMUserMenuItems />
          </UserMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
