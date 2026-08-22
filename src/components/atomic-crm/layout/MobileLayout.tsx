import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation, useMatch } from "react-router";

import { CrmAssistantButton } from "@/modules/assistant";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { MobileNavigation } from "./MobileNavigation";
import { NavigationLayoutAccountSync } from "./NavigationLayoutAccountSync";

export const MobileLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const location = useLocation();
  const matchMessages = useMatch("/messages");
  const matchDealShow = useMatch("/deals/:id/show");
  const matchTicketShow = useMatch("/tickets/:id/show");
  const hideFab =
    Boolean(matchMessages) ||
    Boolean(matchDealShow) ||
    Boolean(matchTicketShow) ||
    location.pathname.startsWith("/messages") ||
    location.pathname.startsWith("/tickets") ||
    location.pathname.startsWith("/billing") ||
    location.pathname.startsWith("/accounts");

  return (
    <>
      <NavigationLayoutAccountSync />
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        <ErrorBoundary FallbackComponent={Error}>
          <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
      {hideFab ? null : <CrmAssistantButton variant="fab" />}
      <MobileNavigation />
      <Notification mobileOffset={{ bottom: "72px" }} />
    </>
  );
};
