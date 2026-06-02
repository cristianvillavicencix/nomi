import {
  BarChart3,
  Building2,
  Clock3,
  FolderKanban,
  Home,
  Landmark,
  Moon,
  ReceiptText,
  Sun,
  Users,
} from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { useGetIdentity } from "ra-core";
import { Link, matchPath, useLocation, useMatch } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { UserMenu } from "@/components/admin/user-menu";
import { useTheme } from "@/components/admin/use-theme";
import { Error } from "@/components/admin/error";
import { Notification } from "@/components/admin/notification";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { canAccess } from "../providers/commons/canAccess";
import { hasMemberCapability } from "../providers/commons/memberModuleAccess";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { CRMUserMenuItems } from "./UserMenuItems";
import { DealsExplorerPanel } from "../deals/DealsExplorerPanel";
import { isLbsMode } from "@/lbs/productMode";
import { LBS_NAV_ITEMS, filterLbsNavItems } from "@/lbs/navigation";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";
import { GlobalMessagesBadge } from "@/components/atomic-crm/layout/GlobalMessagesBadge";
import { WebsiteAuditBackgroundWatcher } from "@/lbs/website-monitor/audit/WebsiteAuditBackgroundWatcher";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import {
  PageActionsProvider,
  PageActionsSlot,
  PageActionsTrailingSlot,
} from "@/components/atomic-crm/layout/PageActions";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import {
  isProposalFocusModePath,
  isProposalPreviewPath,
} from "@/lbs/proposals/proposalFocusMode";
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
  const location = useLocation();
  const { data: identity } = useGetIdentity();
  const { totalUnread: messagesUnreadCount } = useMessagesUnreadCounts();
  const { enabled: websiteMonitorEnabled } = useWebsiteMonitorEnabled(isLbsMode());
  const lbsNavItems = filterLbsNavItems(LBS_NAV_ITEMS, {
    websiteMonitorEnabled,
  });
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const canViewSales = canAccess(identity as any, {
    action: "list",
    resource: "deals",
  });
  const canViewPeople = canAccess(identity as any, {
    action: "list",
    resource: "people",
  });
  const canViewHours = canAccess(identity as any, {
    action: "list",
    resource: "time_entries",
  });
  const canViewPayments = canAccess(identity as any, {
    action: "list",
    resource: "payments",
  });
  const canViewPayroll = canAccess(identity as any, {
    action: "list",
    resource: "payroll_runs",
  });
  const canViewLoans = canViewPayments || canViewPayroll;
  const canViewReports = canAccess(identity as any, {
    action: "list",
    resource: "reports",
  });

  const isActive = (pattern: string) => {
    if (pattern === "/") return location.pathname === "/";
    return !!matchPath(pattern, location.pathname);
  };

  if (isLbsMode()) {
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
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {lbsNavItems.filter((item) =>
                item.capability
                  ? hasMemberCapability(identity as any, item.capability)
                  : item.resource
                    ? canAccess(identity as any, {
                        resource: item.resource,
                        action: item.action ?? "list",
                      })
                    : true,
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarItem
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={<Icon className="h-4 w-4" />}
                    active={isActive(item.activePattern)}
                    badgeCount={
                      item.to === "/messages" ? messagesUnreadCount : 0
                    }
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-1">
          <SidebarFooterControls />
        </SidebarFooter>
      </Sidebar>
    );
  }

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
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarItem
              to="/"
              label="Dashboard"
              icon={<Home />}
              active={isActive("/")}
            />
          </SidebarMenu>
        </SidebarGroup>

        {canViewSales ? (
          <SidebarGroup>
            <SidebarGroupLabel>CRM</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarItem
                to="/deals"
                label="Projects"
                icon={<FolderKanban />}
                active={isActive("/deals/*")}
              />
              <SidebarItem
                to="/companies"
                label="Companies"
                icon={<Building2 />}
                active={isActive("/companies/*")}
              />
              <SidebarItem
                to="/contacts"
                label="Contacts"
                icon={<Users />}
                active={isActive("/contacts/*")}
              />
            </SidebarMenu>
          </SidebarGroup>
        ) : null}

        {canViewHours ||
        canViewPayments ||
        canViewPayroll ||
        canViewLoans ||
        canViewReports ? (
          <SidebarGroup>
            <SidebarGroupLabel>Time &amp; pay</SidebarGroupLabel>
            <SidebarMenu>
              {canViewHours ? (
                <SidebarItem
                  to="/time_entries"
                  label="Hours"
                  icon={<Clock3 />}
                  active={isActive("/time_entries/*")}
                />
              ) : null}
              {canViewPayroll ? (
                <SidebarItem
                  to="/payroll_runs"
                  label="Payroll"
                  icon={<ReceiptText />}
                  active={isActive("/payroll_runs/*")}
                />
              ) : null}
              {canViewLoans ? (
                <SidebarItem
                  to="/employee_loans"
                  label="Loans"
                  icon={<Landmark />}
                  active={isActive("/employee_loans/*")}
                />
              ) : null}
              {canViewReports ? (
                <SidebarItem
                  to="/reports"
                  label="Reports"
                  icon={<BarChart3 />}
                  active={isActive("/reports/*")}
                />
              ) : null}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}

        {canViewPeople ? (
          <SidebarGroup>
            <SidebarGroupLabel>Team</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarItem
                to="/people"
                label="People"
                icon={<Users />}
                active={isActive("/people/*")}
              />
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="p-2 group-data-[collapsible=icon]:p-1">
        <SidebarFooterControls />
      </SidebarFooter>
    </Sidebar>
  );
};

const SidebarItem = ({
  to,
  label,
  icon,
  active,
  badgeCount = 0,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  badgeCount?: number;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={active}>
      <Link to={to} state={{ _scrollToTop: true }} className="relative">
        {icon}
        <span className="truncate">{label}</span>
        {badgeCount > 0 ? (
          <Badge
            variant="default"
            className="ml-auto rounded-full border-0 bg-blue-500 px-1.5 py-0 text-[10px] text-white group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:ml-0"
          >
            {formatUnreadBadgeCount(badgeCount)}
          </Badge>
        ) : null}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

export const SidebarLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const location = useLocation();
  const matchDealShow = useMatch("/deals/:id/show");
  const matchMessages = useMatch("/messages");
  const currentDealId = matchDealShow?.params.id;
  const isMessagesShell = Boolean(matchMessages);
  const isProposalFocusMode = isProposalFocusModePath(location.pathname);
  const isProposalPreview = isProposalPreviewPath(location.pathname);
  const hideGlobalSearch = isMessagesShell || isProposalFocusMode;
  const hideGlobalHeader = isMessagesShell || isProposalPreview;

  return (
    <SidebarProvider className="h-svh overflow-hidden print:h-auto print:overflow-visible">
      <PageActionsProvider>
        <SidebarNavigation />
        <main className="ml-auto flex h-svh min-h-0 w-full max-w-full flex-col overflow-hidden peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))] sm:transition-[width] sm:duration-200 sm:ease-linear print:h-auto print:w-full print:overflow-visible">
          {hideGlobalHeader ? (
            <SpotlightSearchButton variant="hidden" />
          ) : !hideGlobalSearch ? (
            <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
              <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
              <div className="flex shrink-0 items-center gap-1">
                <SpotlightSearchButton />
                <PageActionsTrailingSlot className="flex items-center" />
              </div>
            </header>
          ) : (
            <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
              <PageActionsSlot className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
              <PageActionsTrailingSlot className="ml-auto flex items-center" />
              <SpotlightSearchButton variant="hidden" />
            </header>
          )}
          <div
            className={cn(
              "flex min-h-0 flex-1 print:block print:px-0 print:pt-0 print:pb-0",
              isMessagesShell
                ? "gap-2 p-2 pl-1"
                : isProposalPreview
                  ? "gap-0 p-0"
                  : "gap-4 px-4 pt-2 pb-0",
            )}
          >
            {currentDealId ? (
              <DealsExplorerPanel currentDealId={currentDealId} />
            ) : null}
            <div
              className={cn(
                "min-h-0 min-w-0 flex-1",
                isMessagesShell || isProposalPreview
                  ? "overflow-hidden"
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
          </div>
        </main>
        <GlobalMessagesBadge className="fixed right-3 bottom-3 z-50 print:hidden max-[768px]:bottom-[max(0.75rem,env(safe-area-inset-bottom))]" />
        <WebsiteAuditBackgroundWatcher />
        <Notification />
      </PageActionsProvider>
    </SidebarProvider>
  );
};
