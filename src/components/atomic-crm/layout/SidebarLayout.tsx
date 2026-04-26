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
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useConfigurationLoader } from "../root/useConfigurationLoader";
import { CRMUserMenuItems } from "./UserMenuItems";
import { DealsExplorerPanel } from "../deals/DealsExplorerPanel";
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


  const isActive = (pattern: string) => !!matchPath(pattern, location.pathname);

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
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={active}>
      <Link to={to} state={{ _scrollToTop: true }}>
        {icon}
        {label}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

export const SidebarLayout = ({ children }: { children: ReactNode }) => {
  useConfigurationLoader();
  const matchDealShow = useMatch("/deals/:id/show");
  const currentDealId = matchDealShow?.params.id;

  return (
    <SidebarProvider className="h-svh overflow-hidden print:h-auto print:overflow-visible">
      <SidebarNavigation />
      <main className="ml-auto flex h-svh min-h-0 w-full max-w-full flex-col overflow-hidden peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)] peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))] sm:transition-[width] sm:duration-200 sm:ease-linear print:h-auto print:w-full print:overflow-visible">
        <div className="flex min-h-0 flex-1 gap-4 px-4 pt-4 pb-2 print:block print:px-0 print:pt-0 print:pb-0">
          {currentDealId ? (
            <DealsExplorerPanel currentDealId={currentDealId} />
          ) : null}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1">
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
      <Notification />
    </SidebarProvider>
  );
};
