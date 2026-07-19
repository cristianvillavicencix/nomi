import type { ReactNode } from "react";
import { Layout } from "./Layout";
import { NavigationLayoutAccountSync } from "./NavigationLayoutAccountSync";
import { useNavigationLayoutPreference } from "./navigationLayoutPreference";
import { SidebarLayout } from "./SidebarLayout";

export const DesktopLayout = ({ children }: { children: ReactNode }) => {
  const [layoutMode] = useNavigationLayoutPreference();

  return (
    <>
      <NavigationLayoutAccountSync />
      {layoutMode === "sidebar" ? (
        <SidebarLayout>{children}</SidebarLayout>
      ) : (
        <Layout>{children}</Layout>
      )}
    </>
  );
};
