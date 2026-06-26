import { Bell, Loader2, Save } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";
import {
  filterNotificationCategoryGroups,
  prefsKeyForCategory,
  sanitizeNotificationPrefsForCapabilities,
} from "@/modules/notifications/notificationCategoryAccess";
import {
  DEFAULT_NOTIFICATION_PREFS,
  parseNotificationPrefs,
} from "@/modules/notifications/notificationPrefs";
import {
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationPrefs,
} from "@/modules/notifications/types";

export const ProfileDesktopNotificationsSection = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const {
    prefs,
    desktopSupport,
    requestDesktopPermission,
    updatePrefs,
    isSaving,
    refreshDesktopSupport,
  } = useNotificationPrefsContext();

  const hasCapability = useCallback(
    (capabilityId: string) =>
      hasMemberCapability(identity as AccessIdentity | undefined, capabilityId),
    [identity],
  );

  const visibleCategoryGroups = useMemo(
    () => filterNotificationCategoryGroups(hasCapability),
    [hasCapability],
  );

  const [draft, setDraft] = useState<NotificationPrefs>(prefs);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setDraft(prefs);
  }, [prefs]);

  useEffect(() => {
    refreshDesktopSupport();
    const onVis = () => refreshDesktopSupport();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshDesktopSupport]);

  const setDraftField = <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const requestPermission = async () => {
    setRequesting(true);
    try {
      const next = await requestDesktopPermission();
      if (next === "granted") {
        setDraftField("desktop_enabled", true);
        notify("Desktop notifications enabled for this browser.", {
          type: "success",
        });
      } else if (next === "denied") {
        notify(
          "Notifications are blocked. Allow them for this site in your browser settings.",
          { type: "warning" },
        );
      }
    } finally {
      setRequesting(false);
    }
  };

  const save = async () => {
    const sanitized = sanitizeNotificationPrefsForCapabilities(
      draft,
      hasCapability,
    );
    await updatePrefs(sanitized);
    setDraft(sanitized);
    notify("Notification preferences saved", { type: "success" });
  };

  const resetDefaults = () => {
    setDraft(
      sanitizeNotificationPrefsForCapabilities(
        { ...DEFAULT_NOTIFICATION_PREFS },
        hasCapability,
      ),
    );
  };

  const isDirty =
    JSON.stringify(parseNotificationPrefs(draft)) !==
    JSON.stringify(parseNotificationPrefs(prefs));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" />
          Desktop notifications
        </CardTitle>
        <CardDescription>
          Control sound and system alerts on this device. SMS form alerts still
          use your{" "}
          <Link to="/profile" className="text-foreground underline">
            notification phone
          </Link>{" "}
          above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="notif-sound"
              checked={draft.sound_enabled}
              onCheckedChange={(value) =>
                setDraftField("sound_enabled", value === true)
              }
            />
            <Label htmlFor="notif-sound" className="cursor-pointer font-medium">
              Play sound in the app
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="notif-desktop"
              checked={draft.desktop_enabled}
              onCheckedChange={(value) =>
                setDraftField("desktop_enabled", value === true)
              }
            />
            <Label
              htmlFor="notif-desktop"
              className="cursor-pointer font-medium"
            >
              Show OS desktop notifications when this tab is in the background
            </Label>
          </div>

          {desktopSupport === "unsupported" ? (
            <p className="text-xs text-muted-foreground">
              This browser does not support desktop notifications.
            </p>
          ) : desktopSupport === "granted" ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Browser permission granted. Revoke anytime in site settings.
            </p>
          ) : desktopSupport === "denied" ? (
            <p className="text-xs text-muted-foreground">
              Browser blocked notifications. Allow them in site settings, then
              reload.
            </p>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={requesting}
              onClick={() => void requestPermission()}
            >
              {requesting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Bell className="mr-2 size-4" />
              )}
              Enable browser notifications
            </Button>
          )}
        </div>

        <Separator />

        {visibleCategoryGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-sm font-medium">{group.title}</h3>
            <div className="space-y-2">
              {group.keys.map((category) => {
                const meta = NOTIFICATION_CATEGORY_LABELS[category];
                const prefKey = prefsKeyForCategory(category);
                return (
                  <label
                    key={category}
                    className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      checked={draft[prefKey]}
                      onCheckedChange={(value) =>
                        setDraftField(prefKey, value === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        {meta.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save preferences
          </Button>
          <Button type="button" variant="outline" onClick={resetDefaults}>
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
