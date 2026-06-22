import type { ReactNode } from "react";
import { NotificationPrefsProvider } from "@/modules/notifications/NotificationPrefsContext";
import { MessagesQuickAccessProvider } from "@/modules/messages/MessagesQuickAccessProvider";

export const withLbsMessagesProvider = <P extends { children?: ReactNode }>(
  LayoutComponent: (props: P) => ReactNode,
) => {
  const WrappedLayout = (props: P) => (
    <NotificationPrefsProvider>
      <MessagesQuickAccessProvider>
        <LayoutComponent {...props} />
      </MessagesQuickAccessProvider>
    </NotificationPrefsProvider>
  );

  WrappedLayout.displayName = `WithLbsMessagesProvider(${
    LayoutComponent.displayName ?? LayoutComponent.name ?? "Layout"
  })`;

  return WrappedLayout;
};
