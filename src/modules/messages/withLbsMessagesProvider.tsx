import type { ReactNode } from "react";
import { MessagesQuickAccessProvider } from "@/modules/messages/MessagesQuickAccessProvider";

export const withLbsMessagesProvider = <P extends { children?: ReactNode }>(
  LayoutComponent: (props: P) => ReactNode,
) => {
  const WrappedLayout = (props: P) => (
    <MessagesQuickAccessProvider>
      <LayoutComponent {...props} />
    </MessagesQuickAccessProvider>
  );

  WrappedLayout.displayName = `WithLbsMessagesProvider(${
    LayoutComponent.displayName ?? LayoutComponent.name ?? "Layout"
  })`;

  return WrappedLayout;
};
