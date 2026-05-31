import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { MobileNavigation } from "./MobileNavigation";
import { WebsiteAuditBackgroundWatcher } from "@/lbs/website-monitor/audit/WebsiteAuditBackgroundWatcher";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();

  return (
    <>
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <MobileNavigation />
      <WebsiteAuditBackgroundWatcher />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </>
  );
};
