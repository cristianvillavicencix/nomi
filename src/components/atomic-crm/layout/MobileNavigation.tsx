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

  return (
    <nav
      aria-label="CRM navigation"
      className="pointer-events-none fixed inset-x-3 z-50 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      style={{ bottom: 0 }}
    >
      <div className="glass-dock pointer-events-auto relative z-10 mx-auto flex h-[3.75rem] w-full max-w-lg items-stretch rounded-[26px] px-1">
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
  <Link
    to={href}
    className={cn(
      "relative z-10 flex min-w-0 flex-1 items-stretch justify-center px-0.5 py-1 text-muted-foreground transition-transform active:scale-[0.96]",
      isActive && "text-foreground",
    )}
  >
    <span
      className={cn(
        "relative flex w-full max-w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1 transition-colors",
        isActive && "bg-black/[0.08] dark:bg-white/14",
      )}
    >
      <span className="relative flex size-6 items-center justify-center">
        <Icon className="size-6" weight={sidebarNavIconWeight(isActive)} />
        {badgeCount > 0 ? (
          <Badge
            variant="default"
            className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full border-0 px-1 py-0 text-[10px] leading-4"
          >
            {formatUnreadBadgeCount(badgeCount)}
          </Badge>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[10px] font-medium leading-none tracking-tight">
        {label}
      </span>
    </span>
  </Link>
);
