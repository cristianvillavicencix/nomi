import { Moon, Sun } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { useGetIdentity } from "ra-core";
import { Link, useLocation, useMatch } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { UserMenu } from "@/components/admin/user-menu";
import { useTheme } from "@/components/admin/use-theme";
import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { CRMUserMenuItems } from "./UserMenuItems";
import { DealsExplorerPanel } from "../deals/DealsExplorerPanel";
import { LbsSidebarNav } from "@/app/LbsSidebarNav";
import { useWebsiteMonitorEnabled } from "@/modules/settings/useWebsiteMonitorSettings";
import { useMessagesUnreadCounts } from "@/modules/messages/useMessagesUnreadCounts";
import {
  PageActionsProvider,
  PageActionsSlot,
  PageActionsTrailingSlot,
} from "@/components/atomic-crm/layout/PageActions";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { GlobalQuickCreateMenu } from "@/components/atomic-crm/layout/GlobalQuickCreateMenu";
import { NotificationCenterButton } from "@/modules/notifications/NotificationCenterButton";
import {
  isProposalFocusModePath,
  isProposalPreviewPath,
} from "@/modules/proposals/proposalFocusMode";
import { isBillingInvoiceWorkspace } from "@/modules/billing/billingWorkspaceMode";

const SidebarThemeSwitcher = ({ collapsed }: { collapsed: boolean }) => {
  const { theme, setTheme } = useTheme();
  const activeTheme = theme === "dark" ? "dark" : "light";

  if (collapsed) {
    const nextTheme = activeTheme === "dark" ? "light" : "dark";
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setTheme(nextTheme)}
        className="h-8 w-8"
      >
        {activeTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setTheme("light")}
        className={cn(
          "h-8 flex-1 justify-center gap-1.5 px-2 text-xs",
          activeTheme === "light" &&
            "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Sun className="h-4 w-4" />
        <span>Light</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setTheme("dark")}
        className={cn(
          "h-8 flex-1 justify-center gap-1.5 px-2 text-xs",
          activeTheme === "dark" &&
            "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <Moon className="h-4 w-4" />
        <span>Dark</span>
      </Button>
    </div>
  );
};

const SidebarUserIdentity = ({ collapsed }: { collapsed: boolean }) => {
  const { data: identity } = useGetIdentity();
  const fullName = identity?.fullName ?? "User";
  const role =
    (identity as any)?.role ??
    ((identity as any)?.administrator ? "Admin" : null) ??
    "User";
  const triggerClassName = collapsed
    ? "h-10 w-10 rounded-full p-0"
    : "h-auto w-full justify-start rounded-md p-2";

  return (
    <UserMenu
      trigger={
        <Button type="button" variant="ghost" className={triggerClassName}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={(identity as any)?.avatar} role="presentation" />
            <AvatarFallback>{fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">
                {fullName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {role}
              </span>
            </span>
          ) : null}
        </Button>
      }
    >
      <CRMUserMenuItems />
    </UserMenu>
  );
};

const SidebarFooterControls = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div
      className={cn(
        "p-1",
        collapsed
          ? "flex flex-col items-center justify-center gap-2"
          : "space-y-2",
      )}
    >
      <SidebarUserIdentity collapsed={collapsed} />
      <SidebarThemeSwitcher collapsed={collapsed} />
    </div>
  );
};

const SidebarNavigation = () => {
  const { totalUnread: messagesUnreadCount } = useMessagesUnreadCounts();
  const { enabled: websiteMonitorEnabled } = useWebsiteMonitorEnabled(true);
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <Sidebar variant="floating" collapsible="icon" className="print:hidden">
      <SidebarHeader className="px-2 pt-2 pb-0">
        <div className="relative">
          <SidebarMenu className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-auto py-2 pr-8">
                <Link to="/" className="gap-2">
                  <img
                    className="[.light_&]:hidden h-6"
                    src={darkModeLogo}
                    alt={title}
                  />
                  <img
                    className="[.dark_&]:hidden h-6"
                    src={lightModeLogo}
                    alt={title}
                  />
                  <span className="text-base font-semibold truncate">
                    {title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="relative hidden h-10 items-center justify-center group-data-[collapsible=icon]:flex">
            <Link
              to="/"
              className="absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-150 ease-out group-hover:opacity-0 group-hover:scale-95"
            >
              <img
                className="[.light_&]:hidden h-6"
                src={darkModeLogo}
                alt={title}
              />
              <img
                className="[.dark_&]:hidden h-6"
                src={lightModeLogo}
                alt={title}
              />
            </Link>
            <SidebarTrigger
              className="absolute inset-0 m-auto opacity-0 pointer-events-none transition-[opacity,transform] duration-150 ease-out scale-95 group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto"
              variant="ghost"
              size="icon"
            />
          </div>
          <SidebarTrigger
            className="absolute top-1.5 right-1.5 opacity-100 transition-opacity group-data-[collapsible=icon]:hidden"
            variant="ghost"
            size="icon"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <LbsSidebarNav
          websiteMonitorEnabled={websiteMonitorEnabled}
          messagesUnreadCount={messagesUnreadCount}
        />
      </SidebarContent>
      <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-1">
        <SidebarFooterControls />
      </SidebarFooter>
    </Sidebar>
  );
};

export const SidebarLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const location = useLocation();
  const matchDealShow = useMatch("/deals/:id/show");
  const matchMessages = useMatch("/messages");
  const currentDealId = matchDealShow?.params.id;
  const isMessagesShell = Boolean(matchMessages);
  const isProposalFocusMode = isProposalFocusModePath(location.pathname);
  const isProposalPreview = isProposalPreviewPath(location.pathname);
  const isBillingInvoiceShell = isBillingInvoiceWorkspace(
    location.pathname,
    location.search,
  );
  const hideGlobalSearch = isMessagesShell || isProposalFocusMode;
  const hideGlobalHeader = isMessagesShell || isProposalPreview;
  const showDealExplorer =
    Boolean(currentDealId) && !isMessagesShell && !isProposalPreview;
  const hideGlobalHeaderOnProjectShow = showDealExplorer;

  const globalHeader =
    hideGlobalHeader || hideGlobalHeaderOnProjectShow
      ? null
      : !hideGlobalSearch
        ? (
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
        <div className="flex shrink-0 items-center gap-2">
          <PageActionsTrailingSlot className="flex items-center" />
          <GlobalQuickCreateMenu />
          <NotificationCenterButton />
          <SpotlightSearchButton />
        </div>
      </header>
        )
        : (
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
        <PageActionsTrailingSlot className="ml-auto flex items-center" />
        <GlobalQuickCreateMenu />
        <NotificationCenterButton />
        <SpotlightSearchButton variant="hidden" />
      </header>
        );

  const mainContentPadding = cn(
    "flex min-h-0 flex-1 print:block print:px-0 print:pt-0 print:pb-0",
    isMessagesShell
      ? "gap-2 p-2 pl-1"
      : isProposalPreview
        ? "gap-0 p-0"
        : isBillingInvoiceShell
          ? "gap-0 p-0"
        : showDealExplorer
          ? "px-4 pt-0 pb-0"
          : "gap-4 px-4 pt-2 pb-0",
  );

  const scrollableContent = (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1",
        isMessagesShell || isProposalPreview || isBillingInvoiceShell
          ? "overflow-hidden"
          : "overflow-y-auto overscroll-contain pr-1",
      )}
    >
      <ErrorBoundary FallbackComponent={Error}>
        <Suspense fallback={<Skeleton className="h-12 w-12 rounded-full" />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </div>
  );

  return (
    <SidebarProvider className="h-svh overflow-hidden print:h-auto print:overflow-visible">
      <PageActionsProvider>
        <SidebarNavigation />
        <main
          className={cn(
            "ml-auto flex h-svh min-h-0 w-full max-w-full overflow-hidden peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))] sm:transition-[width] sm:duration-200 sm:ease-linear print:h-auto print:w-full print:overflow-visible",
            showDealExplorer ? "flex-row" : "flex-col",
          )}
        >
          {hideGlobalHeader ? <SpotlightSearchButton variant="hidden" /> : null}

          {showDealExplorer ? (
            <>
              <DealsExplorerPanel currentDealId={currentDealId!} />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {globalHeader}
                <div className={mainContentPadding}>{scrollableContent}</div>
              </div>
            </>
          ) : (
            <>
              {globalHeader}
              <div className={mainContentPadding}>{scrollableContent}</div>
            </>
          )}
        </main>
        <Notification />
      </PageActionsProvider>
    </SidebarProvider>
  );
};
