import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  countUnreadNotificationHistory,
  getNotificationHistory,
  markAllNotificationHistoryRead,
  markNotificationHistoryRead,
} from "@/modules/notifications/notificationHistory";
import { NOTIFICATION_CATEGORY_LABELS } from "@/modules/notifications/types";

export const NotificationCenterButton = () => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => countUnreadNotificationHistory());
  const [items, setItems] = useState(() => getNotificationHistory());

  const refresh = useCallback(() => {
    setItems(getNotificationHistory());
    setUnread(countUnreadNotificationHistory());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("nomi:notifications-updated", handler);
    return () => window.removeEventListener("nomi:notifications-updated", handler);
  }, [refresh]);

  const openSheet = () => {
    setOpen(true);
    markAllNotificationHistoryRead();
    refresh();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-8"
        onClick={openSheet}
        title="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <Badge className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
            {unread > 9 ? "9+" : unread}
          </Badge>
        ) : null}
        <span className="sr-only">Notifications</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Recent alerts from messages, tickets, tasks, and leads on this
              device.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => {
                  const meta = NOTIFICATION_CATEGORY_LABELS[item.category];
                  const content = (
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 transition-colors",
                        !item.read && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{item.title}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {meta.label}
                      </p>
                      {item.body ? (
                        <p className="mt-1 line-clamp-2 text-sm">{item.body}</p>
                      ) : null}
                    </div>
                  );

                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          to={item.href}
                          onClick={() => {
                            markNotificationHistoryRead(item.id);
                            setOpen(false);
                            refresh();
                          }}
                          className="block"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t pt-3">
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/profile">Notification settings</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
