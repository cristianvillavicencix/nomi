import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Icon } from "@phosphor-icons/react";
import {
  Briefcase,
  ChatCircle,
  Receipt,
  Ticket,
  Users,
} from "@phosphor-icons/react";
import { Link, matchPath, useLocation } from "react-router";
import { sidebarNavIconWeight } from "@/app/SidebarNavIcon";
import { getAccountsHubPath } from "@/app/routing";
import { isAccountsHubEnabled } from "@/lib/featureFlags";
import { useMessagesUnreadCounts } from "@/modules/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";
import { useNotificationUnreadCounts } from "@/modules/notifications/useNotificationUnreadCounts";

type MobileTab =
  | "/messages"
  | "/deals"
  | "/tickets"
  | "/contacts"
  | "/billing";

export const MobileNavigation = () => {
  const location = useLocation();
  const { totalUnread } = useMessagesUnreadCounts();
  const { tickets: ticketsUnread } = useNotificationUnreadCounts();
  const accountsHub = isAccountsHubEnabled();
  const contactsHref = accountsHub ? getAccountsHubPath("list") : "/contacts";

  let currentPath: MobileTab | false = false;
  if (
    matchPath("/messages", location.pathname) ||
    matchPath("/messages/*", location.pathname)
  ) {
    currentPath = "/messages";
  } else if (
    matchPath("/deals", location.pathname) ||
    matchPath("/deals/*", location.pathname)
  ) {
    currentPath = "/deals";
  } else if (
    matchPath("/tickets", location.pathname) ||
    matchPath("/tickets/*", location.pathname)
  ) {
    currentPath = "/tickets";
  } else if (
    accountsHub &&
    (matchPath("/accounts", location.pathname) ||
      matchPath("/accounts/*", location.pathname) ||
      matchPath("/contacts/*", location.pathname) ||
      matchPath("/companies/*", location.pathname) ||
      matchPath("/clients/*", location.pathname) ||
      matchPath("/leads/*", location.pathname))
  ) {
    currentPath = "/contacts";
  } else if (
    matchPath("/contacts", location.pathname) ||
    matchPath("/contacts/*", location.pathname)
  ) {
    currentPath = "/contacts";
  } else if (
    matchPath("/billing", location.pathname) ||
    matchPath("/billing/*", location.pathname)
  ) {
    currentPath = "/billing";
  }

  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);
  const iosInset = isPwa && isWebiOS;

  return (
    <nav
      aria-label="CRM navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-secondary pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        // Extra inset for older iOS PWA where env() alone is unreliable
        paddingBottom: iosInset ? 15 : undefined,
        minHeight: iosInset
          ? "calc(3.5rem + 15px)"
          : "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex h-14 w-full items-stretch justify-center">
        <NavigationButton
          href="/messages"
          Icon={ChatCircle}
          label="Messages"
          isActive={currentPath === "/messages"}
          badgeCount={totalUnread}
        />
        <NavigationButton
          href="/deals"
          Icon={Briefcase}
          label="Projects"
          isActive={currentPath === "/deals"}
        />
        <NavigationButton
          href="/tickets"
          Icon={Ticket}
          label="Tickets"
          isActive={currentPath === "/tickets"}
          badgeCount={ticketsUnread}
        />
        <NavigationButton
          href={contactsHref}
          Icon={Users}
          label={accountsHub ? "Accounts" : "Contacts"}
          isActive={currentPath === "/contacts"}
        />
        <NavigationButton
          href="/billing"
          Icon={Receipt}
          label="Invoices"
          isActive={currentPath === "/billing"}
        />
      </div>
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
  badgeCount = 0,
}: {
  href: string;
  Icon: Icon;
  label: string;
  isActive: boolean;
  badgeCount?: number;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "h-auto min-w-0 flex-1 flex-col gap-0.5 rounded-none px-0.5 py-2",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href} className="relative flex flex-col items-center gap-0.5">
      <span className="relative">
        <Icon className="size-5" weight={sidebarNavIconWeight(isActive)} />
        {badgeCount > 0 ? (
          <Badge
            variant="default"
            className="absolute -right-2.5 -top-1.5 min-w-4 rounded-sm border-0 px-1 py-0 text-[10px] leading-4"
          >
            {formatUnreadBadgeCount(badgeCount)}
          </Badge>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[0.55rem] font-medium leading-tight">
        {label}
      </span>
    </Link>
  </Button>
);
