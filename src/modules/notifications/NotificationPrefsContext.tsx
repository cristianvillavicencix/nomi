import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetIdentity, useGetOne, useNotify } from "ra-core";

import type { OrganizationMember } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import {
  getDesktopNotificationSupport,
  requestDesktopNotifications,
  showDesktopNotification,
  type DesktopNotificationSupport,
} from "@/lib/desktopNotifications";
import { playNotificationSoundForCategory } from "@/lib/notificationSound";
import {
  isNotificationCategoryEnabled,
  parseNotificationPrefs,
} from "@/modules/notifications/notificationPrefs";
import { canAccessNotificationCategory } from "@/modules/notifications/notificationCategoryAccess";
import { pushNotificationHistory } from "@/modules/notifications/notificationHistory";
import { navigateToNotificationHref } from "@/modules/notifications/notificationNavigation";
import type {
  NotificationCategory,
  NotificationPrefs,
} from "@/modules/notifications/types";

type PushNotificationInput = {
  category: NotificationCategory;
  title: string;
  body: string;
  tag: string;
  href?: string;
  sound?: boolean;
  desktop?: boolean;
  /** In-app preview card (incoming alerts only). Defaults to true. */
  preview?: boolean;
};

type NotificationPrefsContextValue = {
  prefs: NotificationPrefs;
  desktopSupport: DesktopNotificationSupport;
  refreshDesktopSupport: () => void;
  requestDesktopPermission: () => Promise<DesktopNotificationSupport>;
  updatePrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  isSaving: boolean;
  pushNotification: (input: PushNotificationInput) => void;
};

const NotificationPrefsContext =
  createContext<NotificationPrefsContextValue | null>(null);

const isTabFocused = () =>
  typeof document !== "undefined" &&
  document.visibilityState === "visible" &&
  document.hasFocus();

export const NotificationPrefsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const { data: member, refetch } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: identity?.id },
    { enabled: identity?.id != null },
  );

  const [desktopSupport, setDesktopSupport] =
    useState<DesktopNotificationSupport>(() => getDesktopNotificationSupport());

  const prefs = useMemo(
    () => parseNotificationPrefs(member?.notification_prefs),
    [member?.notification_prefs],
  );

  const refreshDesktopSupport = useCallback(() => {
    setDesktopSupport(getDesktopNotificationSupport());
  }, []);

  useEffect(() => {
    refreshDesktopSupport();
    const onVis = () => refreshDesktopSupport();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshDesktopSupport]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      if (!member?.id) throw new Error("Member not found");
      const next = { ...prefs, ...patch };
      const { error } = await supabase
        .from("organization_members")
        .update({ notification_prefs: next })
        .eq("id", member.id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: ["organization_members", member?.id],
      });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to save preferences",
        {
          type: "error",
        },
      );
    },
  });

  const requestDesktopPermission = useCallback(async () => {
    const next = await requestDesktopNotifications();
    refreshDesktopSupport();
    return next;
  }, [refreshDesktopSupport]);

  const updatePrefs = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      await saveMutation.mutateAsync(patch);
    },
    [saveMutation],
  );

  const pushNotification = useCallback(
    (input: PushNotificationInput) => {
      if (
        !canAccessNotificationCategory(input.category, (capabilityId) =>
          hasMemberCapability(
            identity as AccessIdentity | undefined,
            capabilityId,
          ),
        )
      ) {
        return;
      }
      if (!isNotificationCategoryEnabled(prefs, input.category)) return;

      const shouldSound = input.sound ?? true;
      const shouldDesktop = input.desktop ?? !isTabFocused();
      const shouldPreview = input.preview ?? true;

      const entry = pushNotificationHistory({
        category: input.category,
        title: input.title,
        body: input.body,
        href: input.href,
        tag: input.tag,
      });

      if (shouldPreview && isTabFocused()) {
        window.dispatchEvent(
          new CustomEvent("nomi:notification-preview", { detail: entry }),
        );
      }

      if (shouldSound && prefs.sound_enabled) {
        playNotificationSoundForCategory(input.category);
      }

      if (
        shouldDesktop &&
        prefs.desktop_enabled &&
        desktopSupport === "granted"
      ) {
        showDesktopNotification({
          title: input.title,
          body: input.body,
          tag: input.tag,
          onClick: input.href
            ? () => {
                navigateToNotificationHref(input.href!);
              }
            : undefined,
        });
      }
    },
    [desktopSupport, identity, prefs],
  );

  const value = useMemo(
    () => ({
      prefs,
      desktopSupport,
      refreshDesktopSupport,
      requestDesktopPermission,
      updatePrefs,
      isSaving: saveMutation.isPending,
      pushNotification,
    }),
    [
      desktopSupport,
      prefs,
      pushNotification,
      refreshDesktopSupport,
      requestDesktopPermission,
      saveMutation.isPending,
      updatePrefs,
    ],
  );

  return (
    <NotificationPrefsContext.Provider value={value}>
      {children}
    </NotificationPrefsContext.Provider>
  );
};

export const useNotificationPrefsContext = () => {
  const context = useContext(NotificationPrefsContext);
  if (!context) {
    throw new Error(
      "useNotificationPrefsContext must be used within NotificationPrefsProvider",
    );
  }
  return context;
};

export const useNotificationPrefsContextOptional = () =>
  useContext(NotificationPrefsContext);
