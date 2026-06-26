import type { ReactNode } from "react";
import { NotificationPrefsProvider } from "@/modules/notifications/NotificationPrefsContext";
import { MessagesQuickAccessProvider } from "@/modules/messages/MessagesQuickAccessProvider";
import { VoiceCallProvider } from "@/modules/voice/VoiceCallProvider";

export const withLbsMessagesProvider = <P extends { children?: ReactNode }>(
  LayoutComponent: (props: P) => ReactNode,
) => {
  const WrappedLayout = (props: P) => (
    <NotificationPrefsProvider>
      <MessagesQuickAccessProvider>
        <VoiceCallProvider>
          <LayoutComponent {...props} />
        </VoiceCallProvider>
      </MessagesQuickAccessProvider>
    </NotificationPrefsProvider>
  );

  WrappedLayout.displayName = `WithLbsMessagesProvider(${
    LayoutComponent.displayName ?? LayoutComponent.name ?? "Layout"
  })`;

  return WrappedLayout;
};
