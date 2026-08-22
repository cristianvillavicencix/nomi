import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Icon } from "@phosphor-icons/react";
import { Briefcase, ChatCircle } from "@phosphor-icons/react";
import { Link, matchPath, useLocation } from "react-router";
import { sidebarNavIconWeight } from "@/app/SidebarNavIcon";
import { useMessagesUnreadCounts } from "@/modules/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";

type MobileTab = "/messages" | "/deals";

export const MobileNavigation = () => {
  const location = useLocation();
  const { totalUnread } = useMessagesUnreadCounts();

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
      "h-auto flex-1 flex-col gap-1 rounded-none px-1 py-2",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href} className="relative flex flex-col items-center gap-1">
      <span className="relative">
        <Icon className="size-6" weight={sidebarNavIconWeight(isActive)} />
        {badgeCount > 0 ? (
          <Badge
            variant="default"
            className="absolute -right-2.5 -top-1.5 min-w-4 rounded-sm border-0 px-1 py-0 text-[10px] leading-4"
          >
            {formatUnreadBadgeCount(badgeCount)}
          </Badge>
        ) : null}
      </span>
      <span className="text-[0.6rem] font-medium">{label}</span>
    </Link>
  </Button>
);
