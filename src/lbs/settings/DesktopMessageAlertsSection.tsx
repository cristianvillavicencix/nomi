import { Bell, Loader2 } from "lucide-react";
import { useNotify } from "ra-core";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getMessagingDesktopSupport,
  requestMessagingDesktopNotifications,
  type MessagingDesktopSupport,
} from "@/lbs/messages/messagingDesktopNotifications";

export const DesktopMessageAlertsSection = () => {
  const notify = useNotify();
  const [support, setSupport] = useState<MessagingDesktopSupport>(() => getMessagingDesktopSupport());
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(() => {
    setSupport(getMessagingDesktopSupport());
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const request = async () => {
    setRequesting(true);
    try {
      const next = await requestMessagingDesktopNotifications();
      refresh();
      if (next === "granted") {
        notify("Desktop message alerts enabled for this browser.", { type: "success" });
      } else if (next === "denied") {
        notify(
          "Notifications are blocked. Allow them for this site in your browser settings, then try again.",
          { type: "warning" },
        );
      } else {
        notify("Desktop notifications are not available in this browser.", { type: "info" });
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium">Message alerts on this device</h2>
          <p className="text-sm text-muted-foreground">
            New messages show a banner and play a sound on <span className="text-foreground">any</span>{" "}
            page of the app. Turn on desktop notifications to get system alerts when this tab is in
            the background or minimized (optional; your browser must allow it).
          </p>
        </div>
      </div>

      {support === "unsupported" ? (
        <p className="text-xs text-muted-foreground">
          This browser does not support desktop notifications.
        </p>
      ) : support === "granted" ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Desktop notifications are enabled. You can change or revoke them in the browser site
          settings.
        </p>
      ) : support === "denied" ? (
        <p className="text-xs text-muted-foreground">
          Notifications were blocked. Open your browser settings for this site, set notifications
          to Allow, then reload the app.
        </p>
      ) : (
        <Button type="button" size="sm" disabled={requesting} onClick={() => void request()}>
          {requesting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Bell className="mr-2 size-4" />
          )}
          Enable desktop notifications
        </Button>
      )}
    </div>
  );
};
