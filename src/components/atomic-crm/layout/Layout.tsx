import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation, useMatch } from "react-router";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useConfigurationLoader } from "../root/useConfigurationLoader";
import Header from "./Header";
import {
  PageActionsProvider,
  PageActionsSlot,
  PageActionsTrailingSlot,
} from "@/components/atomic-crm/layout/PageActions";
import { CrmAssistantButton } from "@/modules/assistant";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { GlobalQuickCreateMenu } from "@/components/atomic-crm/layout/GlobalQuickCreateMenu";
import { GlobalCommsHeaderActions } from "@/components/atomic-crm/layout/GlobalCommsHeaderActions";
import { NotificationCenterButton } from "@/modules/notifications/NotificationCenterButton";
import {
  isProposalFocusModePath,
  isProposalPreviewPath,
} from "@/modules/proposals/proposalFocusMode";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";

export const Layout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const location = useLocation();
  const matchDealShow = useMatch("/deals/:id/show");
  const matchMessages = useMatch("/messages");
  const isSettingsShell = Boolean(useMatch("/settings"));
  const isMessagesShell = Boolean(matchMessages);
  const isProposalFocusMode = isProposalFocusModePath(location.pathname);
  const isProposalPreview = isProposalPreviewPath(location.pathname);
  const isBillingInvoiceShell = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );
  const isProjectShowShell = Boolean(matchDealShow);
  const hideGlobalSearch = isMessagesShell || isProposalFocusMode;
  const hideGlobalHeader =
    isMessagesShell || isProposalPreview || isProjectShowShell;

  const pageHeader = hideGlobalHeader ? null : !hideGlobalSearch ? (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
      <div className="flex shrink-0 items-center gap-2">
        <PageActionsTrailingSlot className="flex items-center" />
        <GlobalQuickCreateMenu />
        <GlobalCommsHeaderActions />
        <CrmAssistantButton />
        <SpotlightSearchButton />
        <NotificationCenterButton />
      </div>
    </header>
  ) : (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
      <PageActionsTrailingSlot className="ml-auto flex items-center" />
      <GlobalQuickCreateMenu />
      <GlobalCommsHeaderActions />
      <CrmAssistantButton />
      <SpotlightSearchButton variant="hidden" />
      <NotificationCenterButton />
    </header>
  );

  const mainContentPadding = cn(
    "flex min-h-0 flex-1 print:block print:px-0 print:pt-0 print:pb-0",
    isMessagesShell
      ? "gap-2 p-2 pl-1"
      : isSettingsShell
        ? "gap-0 p-0 overflow-hidden"
        : isProposalPreview
          ? "gap-0 p-0"
          : isBillingInvoiceShell
            ? "gap-0 p-0"
            : isProjectShowShell
              ? "flex min-h-0 flex-1 flex-col px-4 pt-0 pb-0"
              : "gap-4 px-4 pt-2 pb-0",
  );

  return (
    <PageActionsProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden print:h-auto print:overflow-visible">
        <Header />
        {hideGlobalHeader ? (
          <SpotlightSearchButton variant="hidden" />
        ) : null}
        {hideGlobalHeader ? <CrmAssistantButton variant="fab" /> : null}
        {pageHeader}
        <main
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col overflow-hidden",
            mainContentPadding,
          )}
          id="main-content"
        >
          <div
            className={cn(
              "min-h-0 min-w-0 flex-1",
              isMessagesShell ||
                isProposalPreview ||
                isBillingInvoiceShell ||
                isProjectShowShell
                ? "overflow-hidden"
                : isSettingsShell
                  ? "overflow-y-auto overscroll-contain"
                  : "overflow-y-auto overscroll-contain pr-1",
            )}
          >
            <ErrorBoundary FallbackComponent={Error}>
              <Suspense
                fallback={<Skeleton className="h-12 w-12 rounded-full" />}
              >
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        <Notification />
      </div>
    </PageActionsProvider>
  );
};
