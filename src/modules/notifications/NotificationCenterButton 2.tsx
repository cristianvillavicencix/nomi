import { formatDistanceToNow } from "date-fns";
import { Bell, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  clearNotificationHistory,
  countUnreadNotificationHistory,
  getNotificationHistory,
  markAllNotificationHistoryRead,
  markNotificationHistoryRead,
} from "@/modules/notifications/notificationHistory";
import {
  filterNotificationsByTab,
  groupNotificationsForDisplay,
  NOTIFICATION_CATEGORY_ACCENT,
  NOTIFICATION_CATEGORY_ICONS,
  NOTIFICATION_FILTER_TABS,
  countUnreadInTab,
  type GroupedNotification,
  type NotificationFilterTab,
} from "@/modules/notifications/notificationDisplay";
import type { NotificationHistoryItem } from "@/modules/notifications/types";

const ticketLabelFromHref = (href?: string) => {
  if (!href) return "Open ticket";
  const match = href.match(/\/tickets\/(\d+)\//);
  return match ? `Ticket #${match[1]}` : "Open ticket";
};

const NotificationCardShell = ({
  item,
  unread,
  icon: Icon,
  accent,
  title,
  body,
  trailing,
  footer,
  onClick,
}: {
  item: NotificationHistoryItem;
  unread: boolean;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  body?: string | null;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    className={cn(
      "flex gap-3 rounded-lg border px-3 py-2.5 transition-colors",
      unread && "border-primary/30 bg-primary/5",
      onClick && "cursor-pointer hover:bg-muted/40",
    )}
    onClick={onClick}
    onKeyDown={
      onClick
        ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClick();
            }
          }
        : undefined
    }
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <div
      className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
        accent,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </span>
      </div>

      {body ? (
        <p className="mt-1 line-clamp-2 text-sm text-foreground/90">{body}</p>
      ) : null}

      {trailing}
      {footer}
    </div>
  </div>
);

const NotificationGroupRow = ({
  group,
  expanded,
  onToggleExpand,
  onNavigate,
}: {
  group: GroupedNotification;
  expanded: boolean;
  onToggleExpand: () => void;
  onNavigate: (item: NotificationHistoryItem) => void;
}) => {
  const item = group.latest;
  const Icon = NOTIFICATION_CATEGORY_ICONS[item.category];
  const accent = NOTIFICATION_CATEGORY_ACCENT[item.category];

  if (group.isAddressAssignmentGroup) {
    const title = `${group.count} tickets assigned`;

    return (
      <div
        className={cn(
          "rounded-lg border transition-colors",
          group.unreadCount > 0 && "border-primary/30 bg-primary/5",
        )}
      >
        <NotificationCardShell
          item={item}
          unread={group.unreadCount > 0}
          icon={Icon}
          accent={accent}
          title={title}
          body={item.body}
          trailing={
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-normal"
              >
                {group.count} at this address
              </Badge>
              {group.unreadCount > 0 ? (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] font-normal"
                >
                  {group.unreadCount} unread
                </Badge>
              ) : null}
            </div>
          }
          footer={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
            >
              {expanded ? "Hide tickets" : "Show tickets"}
              <ChevronDown
                className={cn(
                  "ml-1 size-3.5 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </Button>
          }
          onClick={onToggleExpand}
        />

        {expanded ? (
          <ul className="space-y-1 border-t px-2 py-2">
            {group.items.map((entry) => (
              <li key={entry.id}>
                {entry.href ? (
                  <Link
                    to={entry.href}
                    onClick={() => onNavigate(entry)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50",
                      !entry.read && "font-medium",
                    )}
                  >
                    <span className="truncate">
                      {ticketLabelFromHref(entry.href)}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </Link>
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {entry.title}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const content = (
    <NotificationCardShell
      item={item}
      unread={group.unreadCount > 0}
      icon={Icon}
      accent={accent}
      title={item.title}
      body={item.body}
      trailing={
        group.count > 1 ? (
          <Badge
            variant="secondary"
            className="mt-2 h-5 px-1.5 text-[10px] font-normal"
          >
            {group.count} updates
          </Badge>
        ) : null
      }
    />
  );

  if (item.href) {
    return (
      <Link to={item.href} onClick={() => onNavigate(item)} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export const NotificationCenterButton = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationFilterTab>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [unread, setUnread] = useState(() => countUnreadNotificationHistory());
  const [items, setItems] = useState(() => getNotificationHistory());

  const refresh = useCallback(() => {
    setItems(getNotificationHistory());
    setUnread(countUnreadNotificationHistory());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdated = () => refresh();
    const onOpenCenter = () => setOpen(true);
    window.addEventListener("nomi:notifications-updated", onUpdated);
    window.addEventListener("nomi:open-notification-center", onOpenCenter);
    return () => {
      window.removeEventListener("nomi:notifications-updated", onUpdated);
      window.removeEventListener("nomi:open-notification-center", onOpenCenter);
    };
  }, [refresh]);

  const tabUnreadCounts = useMemo(
    () =>
      NOTIFICATION_FILTER_TABS.reduce(
        (acc, filterTab) => {
          acc[filterTab.id] = countUnreadInTab(items, filterTab.id);
          return acc;
        },
        {} as Record<NotificationFilterTab, number>,
      ),
    [items],
  );

  const filteredItems = useMemo(
    () => filterNotificationsByTab(items, tab),
    [items, tab],
  );

  const groups = useMemo(
    () => groupNotificationsForDisplay(filteredItems),
    [filteredItems],
  );

  const handleClear = () => {
    clearNotificationHistory();
    setExpandedGroups(new Set());
    refresh();
  };

  const handleMarkAllRead = () => {
    markAllNotificationHistoryRead();
    refresh();
  };

  const handleNavigate = (item: NotificationHistoryItem) => {
    markNotificationHistoryRead(item.id);
    setOpen(false);
    refresh();
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <IconButton
        variant="secondary"
        className="relative size-9"
        onClick={() => setOpen(true)}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <Badge className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
            {unread > 9 ? "9+" : unread}
          </Badge>
        ) : null}
        <span className="sr-only">Notifications</span>
      </IconButton>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div>
                <SheetTitle>Notifications</SheetTitle>
                <SheetDescription className="mt-1">
                  Recent alerts from messages, tickets, tasks, and leads on this
                  device.
                </SheetDescription>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {unread > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </Button>
                ) : null}
                {items.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs text-muted-foreground"
                    onClick={handleClear}
                  >
                    Clear all
                  </Button>
                ) : null}
              </div>
            </div>

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as NotificationFilterTab)}
            >
              <TabsList className="grid h-auto w-full grid-cols-3 gap-0.5 p-1 sm:grid-cols-6">
                {NOTIFICATION_FILTER_TABS.map((filterTab) => {
                  const tabUnread = tabUnreadCounts[filterTab.id];
                  return (
                    <TabsTrigger
                      key={filterTab.id}
                      value={filterTab.id}
                      className="relative px-1 py-1.5 text-[11px] sm:text-xs"
                    >
                      <span>{filterTab.label}</span>
                      {tabUnread > 0 ? (
                        <Badge className="ml-1 h-4 min-w-4 rounded-sm px-1 text-[9px] leading-none">
                          {tabUnread > 9 ? "9+" : tabUnread}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {groups.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {tab === "all"
                  ? "No notifications yet."
                  : `No ${NOTIFICATION_FILTER_TABS.find((row) => row.id === tab)?.label.toLowerCase()} notifications.`}
              </p>
            ) : (
              <ul className="space-y-2">
                {groups.map((group) => (
                  <li key={group.key}>
                    <NotificationGroupRow
                      group={group}
                      expanded={expandedGroups.has(group.key)}
                      onToggleExpand={() => toggleGroupExpanded(group.key)}
                      onNavigate={handleNavigate}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t pt-3">
            <Button variant="secondary" size="sm" asChild className="w-full">
              <Link
                to={{
                  pathname: "/settings",
                  search: buildSettingsSearchParams("notifications").toString(),
                }}
              >
                Notification settings
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
