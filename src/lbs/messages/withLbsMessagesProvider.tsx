import type { ReactNode } from "react";
import { isLbsMode } from "@/lbs/productMode";
import { MessagesQuickAccessProvider } from "@/lbs/messages/MessagesQuickAccessProvider";

export const withLbsMessagesProvider = <P extends { children?: ReactNode }>(
  LayoutComponent: (props: P) => ReactNode,
) => {
  const WrappedLayout = (props: P) => {
    if (!isLbsMode()) {
      return <LayoutComponent {...props} />;
    }

    return (
      <MessagesQuickAccessProvider>
        <LayoutComponent {...props} />
      </MessagesQuickAccessProvider>
    );
  };

  WrappedLayout.displayName = `WithLbsMessagesProvider(${
    LayoutComponent.displayName ?? LayoutComponent.name ?? "Layout"
  })`;

  return WrappedLayout;
};
