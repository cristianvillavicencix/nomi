import { useGetIdentity } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { canAccess } from "../providers/commons/canAccess";
import { hasMemberCapability } from "../providers/commons/memberModuleAccess";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CRMUserMenuItems } from "./UserMenuItems";
import { isLbsMode } from "@/lbs/productMode";
import { LBS_NAV_ITEMS, filterLbsNavItems } from "@/lbs/navigation";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";

const TIME_AND_PAY_PATHS = new Set([
  "/time_entries",
  "/payroll_runs",
  "/employee_loans",
]);

const TIME_AND_PAY_NAV = [
  { label: "Hours", subtitle: "Log and approve time", to: "/time_entries" },
  {
    label: "Payroll",
    subtitle: "Runs, approved hours, and payments",
    to: "/payroll_runs",
  },
  { label: "Loans", subtitle: "Advances and balances", to: "/employee_loans" },
] as const;

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const { data: identity } = useGetIdentity();
  const { enabled: websiteMonitorEnabled } = useWebsiteMonitorEnabled(isLbsMode());
  const lbsNavItems = filterLbsNavItems(LBS_NAV_ITEMS, {
    websiteMonitorEnabled,
  });
  const canViewSales = canAccess(identity as any, {
    action: "list",
    resource: "deals",
  });
  const canViewContacts = canAccess(identity as any, {
    action: "list",
    resource: "contacts",
  });
  const canViewCompanies = canAccess(identity as any, {
    action: "list",
    resource: "companies",
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
  const timeAndPayItems = [
    canViewHours ? TIME_AND_PAY_NAV[0] : null,
    canViewPayroll ? TIME_AND_PAY_NAV[1] : null,
    canViewLoans ? TIME_AND_PAY_NAV[2] : null,
  ].filter((item): item is (typeof TIME_AND_PAY_NAV)[number] => item != null);
  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/people/*", location.pathname)) {
    currentPath = "/people";
  } else if (matchPath("/time_entries/*", location.pathname)) {
    currentPath = "/time_entries";
  } else if (matchPath("/payments/*", location.pathname)) {
    currentPath = "/payroll_runs";
  } else if (matchPath("/payroll_runs/*", location.pathname)) {
    currentPath = "/payroll_runs";
  } else if (matchPath("/employee_loans/*", location.pathname)) {
    currentPath = "/employee_loans";
  } else if (matchPath("/reports/*", location.pathname)) {
    currentPath = "/reports";
  } else {
    currentPath = false;
  }

  const timeAndPaySection =
    typeof currentPath === "string" && TIME_AND_PAY_PATHS.has(currentPath)
      ? currentPath
      : null;

  if (isLbsMode()) {
    return (
      <header className="bg-secondary">
        <div className="px-4">
          <div className="flex justify-between items-center flex-1">
            <Link
              to="/"
              className="flex items-center gap-2 text-secondary-foreground no-underline"
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
              <h1 className="text-xl font-semibold">{title}</h1>
            </Link>
            <nav className="flex flex-wrap">
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
                const isActive =
                  item.activePattern === "/"
                    ? location.pathname === "/"
                    : !!matchPath(item.activePattern, location.pathname);
                return (
                  <NavigationTab
                    key={item.to}
                    label={item.label}
                    to={item.to}
                    isActive={isActive}
                  />
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <ThemeModeToggle />
              <RefreshButton />
              <UserMenu>
                <CRMUserMenuItems />
              </UserMenu>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-secondary">
      <div className="px-4">
        <div className="flex justify-between items-center flex-1">
          <Link
            to="/"
            className="flex items-center gap-2 text-secondary-foreground no-underline"
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
            <h1 className="text-xl font-semibold">{title}</h1>
          </Link>
          <div>
            <nav className="flex">
              <NavigationTab
                label="Dashboard"
                to="/"
                isActive={currentPath === "/"}
              />
              {canViewContacts ? (
                <NavigationTab
                  label="Contacts"
                  to="/contacts"
                  isActive={currentPath === "/contacts"}
                />
              ) : null}
              {canViewCompanies ? (
                <NavigationTab
                  label="Companies"
                  to="/companies"
                  isActive={currentPath === "/companies"}
                />
              ) : null}
              {canViewPeople ? (
                <NavigationTab
                  label="People"
                  to="/people"
                  isActive={currentPath === "/people"}
                />
              ) : null}
              {canViewSales ? (
                <NavigationTab
                  label="Projects"
                  to="/deals"
                  isActive={currentPath === "/deals"}
                />
              ) : null}
              {timeAndPayItems.length > 0 ? (
                <NavigationDropdown
                  label="Time & pay"
                  isActive={timeAndPaySection != null}
                  selectedTo={timeAndPaySection}
                  items={timeAndPayItems}
                />
              ) : null}
              {canViewReports ? (
                <NavigationTab
                  label="Reports"
                  to="/reports"
                  isActive={currentPath === "/reports"}
                />
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeModeToggle />
            <RefreshButton />
            <UserMenu>
              <CRMUserMenuItems />
            </UserMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
  badgeCount = 0,
}: {
  label: string;
  to: string;
  isActive: boolean;
  badgeCount?: number;
}) => (
  <Link
    to={to}
    className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
    {badgeCount > 0 ? (
      <Badge
        variant="secondary"
        className="rounded-full px-1.5 py-0 text-[10px]"
      >
        {formatUnreadBadgeCount(badgeCount)}
      </Badge>
    ) : null}
  </Link>
);

const NavigationDropdown = ({
  label,
  isActive,
  selectedTo,
  items,
}: {
  label: string;
  isActive: boolean;
  selectedTo: string | null;
  items: ReadonlyArray<{ label: string; subtitle: string; to: string }>;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={`inline-flex items-center gap-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
        isActive
          ? "text-secondary-foreground border-secondary-foreground"
          : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
      }`}
    >
      {label}
      <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      {items.map((item) => {
        const isSelected = selectedTo === item.to;
        return (
          <DropdownMenuItem key={item.to} asChild>
            <Link
              to={item.to}
              className={`flex cursor-pointer flex-col gap-0.5 py-2.5 ${
                isSelected ? "bg-accent" : ""
              }`}
            >
              <span className={isSelected ? "font-semibold" : "font-medium"}>
                {item.label}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {item.subtitle}
              </span>
            </Link>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
export default Header;
