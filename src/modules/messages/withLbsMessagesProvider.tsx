import type { ReactNode } from "react";
import { NotificationPrefsProvider } from "@/modules/notifications/NotificationPrefsContext";
import { AppNotificationsLayer } from "@/modules/notifications/AppNotificationsLayer";
import { NotificationPreviewLayer } from "@/modules/notifications/NotificationPreviewLayer";
import { NotificationNavigationListener } from "@/modules/notifications/NotificationNavigationListener";
import { MailComposeProvider } from "@/modules/mail/MailComposeProvider";
import { MessagesQuickAccessProvider } from "@/modules/messages/MessagesQuickAccessProvider";
import { VoiceCallProvider } from "@/modules/voice/VoiceCallProvider";
import { PwaUpdateNotifier } from "@/components/PwaUpdateNotifier";

export const withLbsMessagesProvider = <P extends { children?: ReactNode }>(
  LayoutComponent: (props: P) => ReactNode,
) => {
  const WrappedLayout = (props: P) => (
    <NotificationPrefsProvider>
      <MailComposeProvider>
        <MessagesQuickAccessProvider>
          <VoiceCallProvider>
            <LayoutComponent {...props} />
          </VoiceCallProvider>
        {/*
          Notification layers need both prefs + messages quick-access.
          Keep them here (not inside MessagesQuickAccessProvider) so the
          provider boundary is explicit and stable across layout remounts.
        */}
        <AppNotificationsLayer />
        <NotificationPreviewLayer />
        <NotificationNavigationListener />
        <PwaUpdateNotifier />
        </MessagesQuickAccessProvider>
      </MailComposeProvider>
    </NotificationPrefsProvider>
  );

  WrappedLayout.displayName = `WithLbsMessagesProvider(${
    LayoutComponent.displayName ?? LayoutComponent.name ?? "Layout"
  })`;

  return WrappedLayout;
};
