import type { ReactNode } from "react";
import { Layout } from "./Layout";
import { useNavigationLayoutPreference } from "./navigationLayoutPreference";
import { SidebarLayout } from "./SidebarLayout";

export const DesktopLayout = ({ children }: { children: ReactNode }) => {
  const [layoutMode] = useNavigationLayoutPreference();

  if (layoutMode === "sidebar") {
    return <SidebarLayout>{children}</SidebarLayout>;
  }

  return <Layout>{children}</Layout>;
};

