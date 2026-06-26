import { Bell } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { getDesktopNotificationSupport } from "@/lib/desktopNotifications";

export const DesktopMessageAlertsSection = () => {
  const support = getDesktopNotificationSupport();

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium">Desktop alerts</h2>
          <p className="text-sm text-muted-foreground">
            Message, ticket, task, and lead notifications are configured per
            user in Profile. Each team member can enable browser permission,
            sound, and category toggles there.
          </p>
          {support === "granted" ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              This browser already has notification permission.
            </p>
          ) : null}
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link to="/profile">Open notification settings</Link>
      </Button>
    </div>
  );
};
