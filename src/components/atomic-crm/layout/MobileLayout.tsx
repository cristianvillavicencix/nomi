import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { CrmAssistantButton } from "@/modules/assistant";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { MobileNavigation } from "./MobileNavigation";
import { NavigationLayoutAccountSync } from "./NavigationLayoutAccountSync";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();

  return (
    <>
      <NavigationLayoutAccountSync />
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <CrmAssistantButton variant="fab" />
      <MobileNavigation />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </>
  );
};
