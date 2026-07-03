import { Bell, Loader2 } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";
import {
  filterNotificationCategoryGroups,
  prefsKeyForCategory,
  sanitizeNotificationPrefsForCapabilities,
} from "@/modules/notifications/notificationCategoryAccess";
import {
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationPrefs,
} from "@/modules/notifications/types";
import {
  SettingsRows,
  SettingsSection,
} from "@/modules/settings/SettingsSection";

import { NotificationSettingsRow } from "./NotificationSettingsRow";

const CATEGORY_HINTS = new Set([
  "leads_stale",
  "leads_followup_due",
  "bookings_new",
  "messages_internal",
]);

export const PersonalDesktopNotificationsPanel = () => {
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

  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    refreshDesktopSupport();
    const onVis = () => refreshDesktopSupport();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshDesktopSupport]);

  const persistField = async <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => {
    const next = sanitizeNotificationPrefsForCapabilities(
      { ...prefs, [key]: value },
      hasCapability,
    );
    await updatePrefs(next);
    notify("Preferences updated", { type: "success" });
  };

  const requestPermission = async () => {
    setRequesting(true);
    try {
      const next = await requestDesktopPermission();
      if (next === "granted") {
        await persistField("desktop_enabled", true);
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

  return (
    <div className="space-y-8">
      <SettingsSection title="In-app & desktop">
        <SettingsRows>
          <NotificationSettingsRow
            label="Play sound in the app"
            control={
              <Switch
                checked={prefs.sound_enabled}
                disabled={isSaving}
                onCheckedChange={(checked) =>
                  void persistField("sound_enabled", checked)
                }
              />
            }
          />
          <NotificationSettingsRow
            label="Desktop notifications"
            control={
              <Switch
                checked={prefs.desktop_enabled}
                disabled={isSaving || desktopSupport === "unsupported"}
                onCheckedChange={(checked) =>
                  void persistField("desktop_enabled", checked)
                }
              />
            }
          />
        </SettingsRows>
        {desktopSupport === "unsupported" ? (
          <p className="pt-2 text-xs text-muted-foreground">
            Not supported in this browser.
          </p>
        ) : desktopSupport === "granted" ? null : desktopSupport ===
          "denied" ? (
          <p className="pt-2 text-xs text-muted-foreground">
            Blocked in browser — allow in site settings.
          </p>
        ) : (
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={requesting || isSaving}
              onClick={() => void requestPermission()}
            >
              {requesting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Bell className="mr-2 size-4" />
              )}
              Enable browser permission
            </Button>
          </div>
        )}
        {isSaving ? (
          <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving…
          </p>
        ) : null}
      </SettingsSection>

      {visibleCategoryGroups.map((group) => (
        <SettingsSection key={group.title} title={group.title}>
          <SettingsRows>
            {group.keys.map((category) => {
              const meta = NOTIFICATION_CATEGORY_LABELS[category];
              const prefKey = prefsKeyForCategory(category);
              return (
                <NotificationSettingsRow
                  key={category}
                  label={meta.label}
                  hint={
                    CATEGORY_HINTS.has(category) ? meta.description : undefined
                  }
                  control={
                    <Switch
                      checked={prefs[prefKey]}
                      disabled={isSaving}
                      onCheckedChange={(checked) =>
                        void persistField(prefKey, checked)
                      }
                    />
                  }
                />
              );
            })}
          </SettingsRows>
        </SettingsSection>
      ))}
    </div>
  );
};
